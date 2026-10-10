// ============================================================
// src/app/api/leads/google/route.ts — Google Ads Lead Form webhook
//
// Google Ads Lead Form Extensions send a POST to this URL whenever
// someone submits a lead form. There is no separate GET verification
// step — Google authenticates by embedding a webhook_key in the
// payload body that we compare against the stored value.
//
// Payload shape (Google Ads API v17+):
//   {
//     "google_key": "YOUR_KEY",
//     "lead_id": "...",
//     "user_column_data": [
//       { "column_name": "FULL_NAME",     "string_value": "Jane Doe" },
//       { "column_name": "PHONE_NUMBER",  "string_value": "+1234567890" },
//       { "column_name": "EMAIL",         "string_value": "jane@example.com" },
//       { "column_name": "COMPANY_NAME",  "string_value": "Acme Inc" }
//     ],
//     "campaign_id": "...",
//     "adgroup_id": "...",
//     "creative_id": "..."
//   }
//
// Reference:
//   https://developers.google.com/google-ads/api/docs/lead-forms/overview
// ============================================================

import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ingestLead } from '@/lib/leads/ingest'

export const maxDuration = 30

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

interface GoogleLeadColumnData {
  column_name: string
  string_value?: string
}

interface GoogleLeadPayload {
  google_key?: string
  lead_id?: string
  user_column_data?: GoogleLeadColumnData[]
  campaign_id?: string
  adgroup_id?: string
  creative_id?: string
}

/** Map Google's column_name constants to our fields. */
function extractGoogleLeadFields(columns: GoogleLeadColumnData[]) {
  const map = new Map<string, string>()
  for (const col of columns) {
    if (col.string_value) map.set(col.column_name.toUpperCase(), col.string_value)
  }

  // Google's canonical column names — see the docs reference above.
  const phone =
    map.get('PHONE_NUMBER') ??
    map.get('PHONE') ??
    null

  const name =
    map.get('FULL_NAME') ??
    ([map.get('FIRST_NAME'), map.get('LAST_NAME')].filter(Boolean).join(' ') || null)

  const email = map.get('EMAIL') ?? null
  const company = map.get('COMPANY_NAME') ?? null
  const message = map.get('MESSAGE') ?? null

  return { phone, name, email, company, message }
}

export async function POST(request: Request) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: GoogleLeadPayload
  try {
    body = (await request.json()) as GoogleLeadPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { google_key: googleKey } = body
  if (!googleKey) {
    return NextResponse.json({ error: 'Missing google_key' }, { status: 400 })
  }

  // Look up the account that owns this webhook key. Unlike Meta, Google
  // does not scope leads to a Page ID — the key itself identifies the
  // account.
  const { data: configs, error: configErr } = await supabaseAdmin()
    .from('google_lead_configs')
    .select('account_id')
    .eq('webhook_key', googleKey)

  if (configErr) {
    console.error('[leads/google] config lookup error:', configErr)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  if (!configs || configs.length === 0) {
    // Return 200 so Google doesn't treat unconfigured keys as delivery
    // failures (they'd show in the Ads UI and spam the operator).
    console.warn('[leads/google] no config for google_key:', googleKey?.slice(0, 8) + '…')
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  const accountId = configs[0].account_id

  after(async () => {
    try {
      await processGoogleLead(accountId, body)
    } catch (err) {
      console.error('[leads/google] processing threw:', err)
    }
  })

  // Google expects a 200 to consider the delivery successful.
  return NextResponse.json({ status: 'received' }, { status: 200 })
}

async function processGoogleLead(
  accountId: string,
  payload: GoogleLeadPayload
) {
  const columns = payload.user_column_data ?? []
  const { phone, name, email, company, message } = extractGoogleLeadFields(columns)

  if (!phone) {
    console.warn(
      '[leads/google] lead has no phone number — skipping lead_id:',
      payload.lead_id,
      'columns:',
      columns.map((c) => c.column_name)
    )
    return
  }

  // Build campaign context tags so agents can see which campaign
  // the lead came from without opening the Ads dashboard.
  const extraTags: string[] = []
  if (payload.campaign_id) extraTags.push(`campaign-${payload.campaign_id.slice(-6)}`)

  const result = await ingestLead(supabaseAdmin(), accountId, 'google', {
    phone,
    name,
    email,
    company,
    note: message ?? undefined,
    extraTags,
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: payload.campaign_id ? `google-${payload.campaign_id}` : undefined,
    utm_term: payload.adgroup_id ? `adgroup-${payload.adgroup_id}` : undefined,
    utm_content: payload.creative_id ? `ad-${payload.creative_id}` : undefined,
  })

  console.info(
    `[leads/google] lead ${payload.lead_id} → contact ${result.contactId} (${
      result.created ? 'created' : 'merged'
    })`
  )
}
