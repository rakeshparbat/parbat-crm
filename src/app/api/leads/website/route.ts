// ============================================================
// src/app/api/leads/website/route.ts — Website embed lead form
//
// A public endpoint that website owners call from an embedded
// contact form. Authentication is via the existing API-key
// system (Authorization: Bearer wacrm_live_…, scope: contacts:write).
//
// POST body (all fields optional except phone):
//   {
//     "phone":      "+14155550100",   // required, E.164
//     "name":       "Jane Doe",
//     "email":      "jane@example.com",
//     "company":    "Acme Inc",
//     "message":    "I'd like a demo",  // saved as contact note
//     "source_url": "https://acme.com/contact"  // informational tag
//   }
//
// Response (201 on new contact, 200 on existing):
//   {
//     "contact_id": "uuid",
//     "created":    true
//   }
//
// CORS:
//   Preflight (OPTIONS) returns permissive CORS headers so any
//   website can call this endpoint from client-side JS. The API key
//   is the actual auth boundary — CORS is just ergonomics.
// ============================================================

import { NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/auth/api-context'
import { toApiErrorResponse } from '@/lib/api/v1/respond'
import { ingestLead } from '@/lib/leads/ingest'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const

// Handle browser preflight
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    // Authenticate via the existing API-key system. Any key with the
    // contacts:write scope is accepted — the same scope the /api/v1/contacts
    // POST uses, so one key works for both paths.
    const ctx = await requireApiKey(request, 'contacts:write')

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a JSON object' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    if (!phone) {
      return NextResponse.json(
        { error: "'phone' is required" },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const name = typeof body.name === 'string' ? body.name.trim() : null
    const email = typeof body.email === 'string' ? body.email.trim() : null
    const company = typeof body.company === 'string' ? body.company.trim() : null
    const message = typeof body.message === 'string' ? body.message.trim() : null
    const sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim() : null

    // Extract UTM parameters directly from body or parse from source_url
    let utmSource = typeof body.utm_source === 'string' ? body.utm_source.trim() : null
    let utmMedium = typeof body.utm_medium === 'string' ? body.utm_medium.trim() : null
    let utmCampaign = typeof body.utm_campaign === 'string' ? body.utm_campaign.trim() : null
    let utmTerm = typeof body.utm_term === 'string' ? body.utm_term.trim() : null
    let utmContent = typeof body.utm_content === 'string' ? body.utm_content.trim() : null

    // Build extra tags from context metadata so agents can see the
    // originating URL without opening a separate analytics tool.
    const extraTags: string[] = []
    if (sourceUrl) {
      try {
        const parsedUrl = new URL(sourceUrl)
        const hostname = parsedUrl.hostname.replace(/^www\./, '')
        extraTags.push(`site-${hostname}`)

        // If UTM parameters weren't explicitly supplied, extract from query string
        if (!utmSource && parsedUrl.searchParams.get('utm_source')) utmSource = parsedUrl.searchParams.get('utm_source')
        if (!utmMedium && parsedUrl.searchParams.get('utm_medium')) utmMedium = parsedUrl.searchParams.get('utm_medium')
        if (!utmCampaign && parsedUrl.searchParams.get('utm_campaign')) utmCampaign = parsedUrl.searchParams.get('utm_campaign')
        if (!utmTerm && parsedUrl.searchParams.get('utm_term')) utmTerm = parsedUrl.searchParams.get('utm_term')
        if (!utmContent && parsedUrl.searchParams.get('utm_content')) utmContent = parsedUrl.searchParams.get('utm_content')
      } catch {
        // Malformed URL — just skip the tag.
      }
    }

    const result = await ingestLead(ctx.supabase, ctx.accountId, 'website', {
      phone,
      name,
      email,
      company,
      note: message ?? undefined,
      extraTags,
      utm_source: utmSource ?? 'website',
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_term: utmTerm,
      utm_content: utmContent,
      landing_page_url: sourceUrl,
    })

    return NextResponse.json(
      { contact_id: result.contactId, created: result.created },
      { status: result.created ? 201 : 200, headers: CORS_HEADERS }
    )
  } catch (err) {
    const res = await toApiErrorResponse(err)
    // Re-attach CORS so browser callers still see a parseable error
    // instead of a CORS failure masking the real problem.
    const body = await res.text()
    return new Response(body, {
      status: res.status,
      headers: {
        ...Object.fromEntries(res.headers.entries()),
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    })
  }
}
