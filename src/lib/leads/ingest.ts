// ============================================================
// src/lib/leads/ingest.ts — Shared lead-ingestion helper
//
// Called by all three lead webhook handlers (Meta, Google, Website).
// Reuses the same find-or-create + tag logic the /api/v1/contacts
// route uses, so every lead lands in the contacts list identically
// regardless of its source.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  findOrCreateContact,
  setContactTags,
  resolveAuditUserId,
} from '@/lib/api/v1/contacts'

export type LeadSource = 'meta' | 'google' | 'website'

export interface LeadInput {
  /** Contacts must have a phone in international E.164 format (+...). */
  phone: string
  name?: string | null
  email?: string | null
  company?: string | null
  /** Free-text note to attach (e.g. the message body from a web form). */
  note?: string | null
  /** Additional tags beyond the auto-applied source tag. */
  extraTags?: string[]
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_term?: string | null
  utm_content?: string | null
  landing_page_url?: string | null
}

export interface IngestResult {
  contactId: string
  created: boolean
}

/**
 * Find-or-create a contact from a lead, stamp the lead_source,
 * attach an auto tag (e.g. "meta-lead"), and optionally save a note.
 *
 * This is intentionally thin — no conversation, no message. The lead
 * lands in Contacts; the agent follows up via WhatsApp manually or
 * via an automation trigger.
 */
export async function ingestLead(
  db: SupabaseClient,
  accountId: string,
  source: LeadSource,
  input: LeadInput
): Promise<IngestResult> {
  const auditUserId = await resolveAuditUserId(db, accountId)

  // Find or create the contact. Reuses the shared dedupe logic so a
  // lead with the same phone as an existing WhatsApp contact merges,
  // not forks.
  const { id: contactId, created } = await findOrCreateContact(
    db,
    accountId,
    auditUserId,
    {
      phone: input.phone,
      name: input.name ?? null,
      email: input.email ?? null,
      company: input.company ?? null,
    }
  )

  const utmPayload: Record<string, string | null> = {
    lead_source: source,
  }
  if (input.utm_source) utmPayload.utm_source = input.utm_source
  if (input.utm_medium) utmPayload.utm_medium = input.utm_medium
  if (input.utm_campaign) utmPayload.utm_campaign = input.utm_campaign
  if (input.utm_term) utmPayload.utm_term = input.utm_term
  if (input.utm_content) utmPayload.utm_content = input.utm_content
  if (input.landing_page_url) utmPayload.landing_page_url = input.landing_page_url

  // Stamp lead_source and UTM parameters on contact
  if (created) {
    await db
      .from('contacts')
      .update(utmPayload)
      .eq('id', contactId)
  } else {
    // If existing, fill in any missing fields
    await db
      .from('contacts')
      .update(utmPayload)
      .eq('id', contactId)
      .is('lead_source', null)
  }

  // Always apply the source tag (idempotent — setContactTags diffs the
  // current join before writing). Extra tags from the caller are merged
  // in so a caller can pass campaign-specific tags alongside.
  const sourceTags: Record<LeadSource, string> = {
    meta: 'meta-lead',
    google: 'google-lead',
    website: 'website-lead',
  }
  const tagsToApply = [sourceTags[source], ...(input.extraTags ?? [])]

  // setContactTags REPLACES all tags. We want ADDITIVE behaviour here —
  // merge with whatever tags the contact already has.
  const { data: existingTagRows } = await db
    .from('contact_tags')
    .select('tags(name)')
    .eq('contact_id', contactId)

  const existingTagNames: string[] = (existingTagRows ?? []).flatMap(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => (r.tags?.name ? [r.tags.name as string] : [])
  )

  const mergedTags = Array.from(new Set([...existingTagNames, ...tagsToApply]))
  await setContactTags(db, accountId, auditUserId, contactId, mergedTags)

  // Persist the note if provided (e.g. web form message body).
  if (input.note?.trim()) {
    const { error: noteErr } = await db.from('contact_notes').insert({
      contact_id: contactId,
      user_id: auditUserId,
      note_text: `[${source} lead] ${input.note.trim()}`,
    })
    if (noteErr) {
      // Non-fatal — the contact was created; losing the note is
      // inconvenient but not catastrophic.
      console.error('[leads/ingest] note insert failed:', noteErr.message)
    }
  }

  return { contactId, created }
}
