// ============================================================
// src/app/api/leads/meta/route.ts — Meta Lead Ads webhook
//
// Two endpoints:
//
//   GET  — Facebook webhook verification handshake.
//          Meta sends hub.mode, hub.challenge, hub.verify_token.
//          We check hub.verify_token against every meta_lead_configs
//          row (decrypting each stored token) and echo the challenge
//          on a match.
//
//   POST — Receive a leadgen event. Meta sends the lead *id* only;
//          we fetch the full field_data from the Graph API, then
//          ingest the contact via the shared `ingestLead` helper.
//
// Signature verification:
//   Uses the same verifyMetaWebhookSignature helper the WhatsApp
//   webhook uses — same Meta app secret, same x-hub-signature-256
//   header. The WhatsApp and Lead Ads webhooks can share one App if
//   the user subscribes both fields under it.
//
// Reference:
//   https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving
// ============================================================

import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature'
import { ingestLead } from '@/lib/leads/ingest'

export const maxDuration = 60

// Lazy service-role client — mirrors the pattern in the WhatsApp webhook.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

// ============================================================
// Graph API helper — fetch the full lead record
// ============================================================
interface MetaLeadFieldData {
  name: string
  values: string[]
}

interface MetaLeadRecord {
  id: string
  field_data: MetaLeadFieldData[]
  created_time: string
}

async function fetchLeadFromGraph(
  leadgenId: string,
  pageAccessToken: string
): Promise<MetaLeadRecord | null> {
  const url = `https://graph.facebook.com/v21.0/${leadgenId}?fields=field_data,created_time&access_token=${pageAccessToken}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.text()
      console.error('[leads/meta] Graph API error fetching lead:', leadgenId, body)
      return null
    }
    return (await res.json()) as MetaLeadRecord
  } catch (err) {
    console.error('[leads/meta] Graph API fetch threw:', err)
    return null
  }
}

/** Map Meta's column_name values to our fields (case-insensitive). */
function extractLeadFields(fieldData: MetaLeadFieldData[]) {
  const map = new Map<string, string>()
  for (const f of fieldData) {
    if (f.values?.[0]) map.set(f.name.toLowerCase().trim(), f.values[0].trim())
  }

  const phone =
    map.get('phone_number') ??
    map.get('phone') ??
    map.get('mobile') ??
    map.get('mobile_number') ??
    map.get('contact_number') ??
    map.get('phone_no') ??
    map.get('phonenumber') ??
    map.get('whatsapp_number') ??
    null

  const name =
    map.get('full_name') ??
    ([map.get('first_name'), map.get('last_name')].filter(Boolean).join(' ') || null)

  const email = map.get('email') ?? map.get('email_address') ?? null
  const company = map.get('company_name') ?? map.get('company') ?? null
  const message = map.get('message') ?? map.get('comment') ?? null

  // Capture any extra question fields into a note so no user input is lost
  const standardKeys = new Set([
    'phone_number',
    'phone',
    'mobile',
    'mobile_number',
    'contact_number',
    'phone_no',
    'phonenumber',
    'whatsapp_number',
    'full_name',
    'first_name',
    'last_name',
    'email',
    'email_address',
    'company_name',
    'company',
    'message',
    'comment',
  ])

  const extraDetails: string[] = []
  if (message) extraDetails.push(message)
  for (const f of fieldData) {
    const key = f.name.toLowerCase().trim()
    if (!standardKeys.has(key) && f.values?.[0]) {
      extraDetails.push(`${f.name}: ${f.values.join(', ')}`)
    }
  }

  const note = extraDetails.length > 0 ? extraDetails.join('\n') : null

  return { phone, name, email, company, note }
}

// ============================================================
// GET — webhook subscription verification
// ============================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = searchParams.get('hub.verify_token')

    if (mode !== 'subscribe' || !challenge || !verifyToken) {
      return NextResponse.json(
        { error: 'Missing verification parameters' },
        { status: 400 }
      )
    }

    // Fast-path: Check environment variable fallback (e.g. META_VERIFY_TOKEN or WHATSAPP_VERIFY_TOKEN)
    const envVerifyToken = process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN
    if (envVerifyToken && envVerifyToken === verifyToken) {
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Walk all configs and attempt to decrypt each verify_token until
    // one matches the presented value.
    const { data: configs, error } = await supabaseAdmin()
      .from('meta_lead_configs')
      .select('id, verify_token')

    if (error || !configs) {
      console.error('[leads/meta] error fetching configs for verification:', error)
      return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
    }

    let matched = false
    for (const cfg of configs) {
      try {
        if (decrypt(cfg.verify_token) === verifyToken) {
          matched = true
          break
        }
      } catch {
        // Malformed or wrong-key row — skip.
      }
    }

    if (!matched) {
      return NextResponse.json({ error: 'Verify token mismatch' }, { status: 403 })
    }

    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (err) {
    console.error('[leads/meta] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// POST — receive leadgen event
// ============================================================
export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  // Verify the payload was signed by Meta. The same META_APP_SECRET env
  // var used by the WhatsApp webhook covers Lead Ads webhooks too (they
  // live under the same Meta App).
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.warn('[leads/meta] rejected request with invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Ack Meta immediately; process inside after() so a slow Graph API
  // call doesn't cause Meta to retry.
  after(async () => {
    try {
      await processMetaLeadEvent(body)
    } catch (err) {
      console.error('[leads/meta] processMetaLeadEvent threw:', err)
    }
  })

  return NextResponse.json({ status: 'received' }, { status: 200 })
}

async function processMetaLeadEvent(body: {
  entry?: Array<{
    id: string // Page ID
    changes?: Array<{
      field: string
      value: {
        leadgen_id?: string
        page_id?: string
        form_id?: string
        created_time?: number
      }
    }>
  }>
}) {
  if (!body.entry) return

  for (const entry of body.entry) {
    if (!entry.changes) continue
    for (const change of entry.changes) {
      if (change.field !== 'leadgen' || !change.value) continue

      const leadgenId = change.value.leadgen_id
      const pageId = change.value.page_id || entry.id

      if (!leadgenId || !pageId) {
        console.warn('[leads/meta] missing leadgen_id or page_id in event change:', change)
        continue
      }

      // Look up the account this page belongs to.
      const { data: configs, error: configErr } = await supabaseAdmin()
        .from('meta_lead_configs')
        .select('account_id, page_access_token')
        .eq('page_id', pageId)

      if (configErr) {
        console.error('[leads/meta] error looking up config for page_id:', pageId, configErr)
        continue
      }

      if (!configs || configs.length === 0) {
        console.warn('[leads/meta] no config for page_id:', pageId)
        continue
      }

      const cfg = configs[0]
      let pageAccessToken: string
      try {
        pageAccessToken = decrypt(cfg.page_access_token)
      } catch (err) {
        console.error('[leads/meta] failed to decrypt page access token:', err)
        continue
      }

      const leadRecord = await fetchLeadFromGraph(leadgenId, pageAccessToken)
      if (!leadRecord) continue

      const { phone, name, email, company, note } = extractLeadFields(
        leadRecord.field_data ?? []
      )

      if (!phone) {
        console.warn(
          '[leads/meta] lead has no phone number — skipping:',
          leadgenId,
          'fields:',
          (leadRecord.field_data ?? []).map((f) => f.name)
        )
        continue
      }

      let cleanPhone = phone.trim()
      if (!cleanPhone.startsWith('+')) {
        cleanPhone = `+${cleanPhone}`
      }

      try {
        const formTag = change.value.form_id
          ? `form-${change.value.form_id}`
          : `lead-${leadRecord.id.slice(-6)}`

        const result = await ingestLead(supabaseAdmin(), cfg.account_id, 'meta', {
          phone: cleanPhone,
          name,
          email,
          company,
          note,
          extraTags: [formTag],
        })

        console.info(
          `[leads/meta] lead ${leadgenId} → contact ${result.contactId} (${
            result.created ? 'created' : 'merged'
          })`
        )
      } catch (err) {
        console.error('[leads/meta] error ingesting lead:', leadgenId, err)
      }
    }
  }
}
