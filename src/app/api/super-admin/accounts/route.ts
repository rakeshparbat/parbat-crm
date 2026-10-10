import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/super-admin';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const superAdmin = await verifySuperAdmin();
  if (!superAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
  }

  const adminDb = getAdminClient() as any;

  // Fetch all accounts
  const { data: accounts, error: accountsError } = await adminDb
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 });
  }

  // Fetch owner details and metrics
  const enrichedAccounts = await Promise.all(
    (accounts || []).map(async (acc: any) => {
      const [ownerRes, membersRes, contactsRes] = await Promise.all([
        adminDb.from('profiles').select('full_name, email').eq('user_id', acc.owner_user_id).maybeSingle(),
        adminDb.from('profiles').select('id', { count: 'exact', head: true }).eq('account_id', acc.id),
        adminDb.from('contacts').select('id', { count: 'exact', head: true }).eq('account_id', acc.id),
      ]);

      return {
        ...acc,
        owner_name: ownerRes.data?.full_name || 'Unknown',
        owner_email: ownerRes.data?.email || 'No email',
        members_count: membersRes.count || 0,
        contacts_count: contactsRes.count || 0,
      };
    })
  );

  return NextResponse.json({ accounts: enrichedAccounts });
}

export async function POST(request: Request) {
  const superAdmin = await verifySuperAdmin();
  if (!superAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { companyName, ownerName, ownerEmail, password, aiEnabled, aiQuota, broadcastsEnabled } = body;

    if (!companyName || !ownerEmail || !password) {
      return NextResponse.json({ error: 'Company Name, Owner Email, and Password are required' }, { status: 400 });
    }

    const adminDb = getAdminClient() as any;

    // 1. Create the owner user in Supabase auth
    const { data: userData, error: userError } = await adminDb.auth.admin.createUser({
      email: ownerEmail.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: ownerName?.trim() || companyName.trim(),
      },
    });

    if (userError || !userData?.user) {
      return NextResponse.json({ error: userError?.message || 'Failed to create user' }, { status: 400 });
    }

    const userId = userData.user.id;

    // 2. Create the tenant account
    const { data: newAccount, error: accountError } = await adminDb
      .from('accounts')
      .insert({
        name: companyName.trim(),
        owner_user_id: userId,
        is_active: true,
        ai_enabled: Boolean(aiEnabled),
        broadcasts_enabled: Boolean(broadcastsEnabled),
        ai_monthly_quota: Number(aiQuota) || 1000,
      })
      .select()
      .single();

    if (accountError || !newAccount) {
      // Clean up auth user if account creation failed
      await adminDb.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: accountError?.message || 'Failed to create account' }, { status: 500 });
    }

    // 3. Upsert profile for the owner linking them to this account
    const { error: profileError } = await adminDb
      .from('profiles')
      .upsert({
        user_id: userId,
        full_name: ownerName?.trim() || companyName.trim(),
        email: ownerEmail.trim().toLowerCase(),
        account_id: newAccount.id,
        account_role: 'owner',
        is_super_admin: false,
      });

    if (profileError) {
      console.warn('[super-admin] profile upsert warning:', profileError);
    }

    return NextResponse.json({
      success: true,
      account: newAccount,
      owner: {
        id: userId,
        email: ownerEmail,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const superAdmin = await verifySuperAdmin();
  if (!superAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { accountId, isActive, suspensionReason, aiEnabled, aiQuota, broadcastsEnabled } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};
    if (typeof isActive === 'boolean') updatePayload.is_active = isActive;
    if (typeof suspensionReason !== 'undefined') updatePayload.suspension_reason = suspensionReason;
    if (typeof aiEnabled === 'boolean') updatePayload.ai_enabled = aiEnabled;
    if (typeof broadcastsEnabled === 'boolean') updatePayload.broadcasts_enabled = broadcastsEnabled;
    if (typeof aiQuota === 'number') updatePayload.ai_monthly_quota = aiQuota;

    const adminDb = getAdminClient() as any;
    const { data: updated, error } = await adminDb
      .from('accounts')
      .update(updatePayload)
      .eq('id', accountId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, account: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
