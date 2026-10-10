import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifySuperAdmin } from '@/lib/auth/super-admin';
import { ShieldAlert, ArrowLeft, LayoutDashboard, Building, Cpu, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Super Admin | Platform Control Center',
};

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const superAdmin = await verifySuperAdmin();

  if (!superAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 text-center space-y-4">
          <div className="mx-auto size-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Access Restricted</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You must be a platform Super Admin to access this control center. If you believe this is an error, please check your account permissions in Supabase.
          </p>
          <div className="pt-2">
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="size-4 mr-2" /> Back to CRM
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      {/* Top Header */}
      <header className="border-b border-border/70 bg-card/50 backdrop-blur sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-base shadow-sm">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-foreground">
                Platform Super Admin
              </span>
              <span className="rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                Full Control
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Logged in as <span className="font-mono text-foreground">{superAdmin.email}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              <LayoutDashboard className="size-3.5 mr-1.5" />
              Open CRM Workspace
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {children}
      </main>
    </div>
  );
}
