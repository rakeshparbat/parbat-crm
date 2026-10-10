import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/super-admin';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const superAdmin = await verifySuperAdmin();
  if (!superAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
  }

  try {
    const { targetAccountId } = await request.json();
    if (!targetAccountId) {
      return NextResponse.json({ error: 'targetAccountId is required' }, { status: 400 });
    }

    const adminDb = getAdminClient() as any;

    // Verify account exists
    const { data: targetAccount, error: accErr } = await adminDb
      .from('accounts')
      .select('id, name')
      .eq('id', targetAccountId)
      .single();

    if (accErr || !targetAccount) {
      return NextResponse.json({ error: 'Target account not found' }, { status: 404 });
    }

    // Switch Super Admin's profile to target account with owner role for full operation
    const { error: updateErr } = await adminDb
      .from('profiles')
      .update({
        account_id: targetAccountId,
        account_role: 'owner',
      })
      .eq('user_id', superAdmin.userId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      account: targetAccount,
      message: `Switched workspace to ${targetAccount.name}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
