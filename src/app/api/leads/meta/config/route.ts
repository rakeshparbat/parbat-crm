// ============================================================
// src/app/api/leads/meta/config/route.ts
//
// POST — Create or update a Meta Lead Ads config for the current
//        account. Encrypts the page access token and verify token
//        before writing to the database (same AES-256-GCM scheme as
//        whatsapp_config). Only callable from the dashboard (cookie
//        session auth, admin+ role).
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/whatsapp/encryption'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verify the caller has a valid session and is admin+.
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve account + role from the profiles table (populated by migration 017).
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('account_id, account_role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileErr || !profile?.account_id) {
      return NextResponse.json({ error: 'Account not found' }, { status: 403 })
    }

    const role = profile.account_role as string | null
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden: admin+ required' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const pageId = typeof body.page_id === 'string' ? body.page_id.trim() : ''
    const rawToken = typeof body.page_access_token === 'string' ? body.page_access_token.trim() : ''
    const rawVerify = typeof body.verify_token === 'string' ? body.verify_token.trim() : ''
    const label = typeof body.label === 'string' ? body.label.trim() : 'Meta Lead Ads'

    if (!pageId || !rawToken || !rawVerify) {
      return NextResponse.json(
        { error: 'page_id, page_access_token, and verify_token are required' },
        { status: 400 }
      )
    }

    // Validate page_id is numeric (Meta's format).
    if (!/^\d+$/.test(pageId)) {
      return NextResponse.json({ error: 'page_id must be a numeric string' }, { status: 400 })
    }

    const encryptedToken = encrypt(rawToken)
    const encryptedVerify = encrypt(rawVerify)

    const { error: upsertErr } = await supabase
      .from('meta_lead_configs')
      .upsert(
        {
          account_id: profile.account_id,
          page_id: pageId,
          page_access_token: encryptedToken,
          verify_token: encryptedVerify,
          label,
        },
        { onConflict: 'account_id,page_id' }
      )

    if (upsertErr) {
      console.error('[leads/meta/config] upsert error:', upsertErr)
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[leads/meta/config] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
