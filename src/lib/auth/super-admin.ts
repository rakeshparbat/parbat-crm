import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export interface SuperAdminContext {
  isSuperAdmin: boolean;
  userId: string;
  email: string;
}

export async function verifySuperAdmin(): Promise<SuperAdminContext | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const adminDb = getAdminClient();
    const { data: profile, error: profileError } = await (adminDb as any)
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || !profile.is_super_admin) {
      return null;
    }

    return {
      isSuperAdmin: true,
      userId: user.id,
      email: user.email ?? '',
    };
  } catch (err) {
    console.error('[super-admin] verification error:', err);
    return null;
  }
}
