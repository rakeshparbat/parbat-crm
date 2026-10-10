'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Building2,
  Users,
  MessageSquare,
  Sparkles,
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
  Settings2,
  KeyRound,
  Check,
  RefreshCw,
  Radio,
  ExternalLink,
  LogIn,
  Wrench,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SuperAdminAccount {
  id: string;
  name: string;
  owner_name: string;
  owner_email: string;
  is_active: boolean;
  ai_enabled: boolean;
  broadcasts_enabled: boolean;
  ai_monthly_quota: number;
  members_count: number;
  contacts_count: number;
  created_at: string;
}

export default function SuperAdminPage() {
  const [accounts, setAccounts] = useState<SuperAdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Provisioning Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [broadcastsEnabled, setBroadcastsEnabled] = useState(false);
  const [aiQuota, setAiQuota] = useState(1000);
  const [creating, setCreating] = useState(false);

  // Quick Action Pending
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/accounts');
      const data = await res.json();
      if (res.ok) {
        setAccounts(data.accounts || []);
      } else {
        toast.error(data.error || 'Failed to fetch accounts');
      }
    } catch {
      toast.error('Network error while loading accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !ownerEmail.trim() || !password) {
      toast.error('Please fill in Company Name, Email, and Password');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/super-admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          ownerName,
          ownerEmail,
          password,
          aiEnabled,
          broadcastsEnabled,
          aiQuota,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      toast.success(`Client "${companyName}" provisioned successfully!`);
      setModalOpen(false);
      setCompanyName('');
      setOwnerName('');
      setOwnerEmail('');
      setPassword('');
      setAiEnabled(false);
      setBroadcastsEnabled(false);
      setAiQuota(1000);
      fetchAccounts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error creating account';
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const toggleAccountStatus = async (account: SuperAdminAccount) => {
    setActionId(account.id);
    const newStatus = !account.is_active;
    try {
      const res = await fetch('/api/super-admin/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          isActive: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Account marked as ${newStatus ? 'Active' : 'Suspended'}`);
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, is_active: newStatus } : a))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update';
      toast.error(message);
    } finally {
      setActionId(null);
    }
  };

  const toggleAiStatus = async (account: SuperAdminAccount) => {
    setActionId(account.id);
    const newAi = !account.ai_enabled;
    try {
      const res = await fetch('/api/super-admin/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          aiEnabled: newAi,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`AI features ${newAi ? 'Enabled' : 'Disabled'} for ${account.name}`);
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, ai_enabled: newAi } : a))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update AI';
      toast.error(message);
    } finally {
      setActionId(null);
    }
  };

  const toggleBroadcastStatus = async (account: SuperAdminAccount) => {
    setActionId(account.id);
    const newBroadcast = !account.broadcasts_enabled;
    try {
      const res = await fetch('/api/super-admin/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          broadcastsEnabled: newBroadcast,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`WhatsApp Campaigns ${newBroadcast ? 'Enabled' : 'Disabled'} for ${account.name}`);
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, broadcasts_enabled: newBroadcast } : a))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update Campaigns access';
      toast.error(message);
    } finally {
      setActionId(null);
    }
  };

  const handleSwitchWorkspace = async (account: SuperAdminAccount, redirectPath = '/dashboard') => {
    setActionId(account.id);
    try {
      const res = await fetch('/api/super-admin/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAccountId: account.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Switching to ${account.name}...`);
      window.location.href = redirectPath;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to switch workspace';
      toast.error(message);
      setActionId(null);
    }
  };

  const filteredAccounts = accounts.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.owner_email.toLowerCase().includes(search.toLowerCase()) ||
      a.owner_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalClients = accounts.length;
  const activeClients = accounts.filter((a) => a.is_active).length;
  const totalContacts = accounts.reduce((sum, a) => sum + (a.contacts_count || 0), 0);
  const aiEnabledCount = accounts.filter((a) => a.ai_enabled).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Clients</span>
            <Building2 className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">{totalClients}</div>
          <p className="text-[11px] text-muted-foreground">{activeClients} actively running</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Account Health</span>
            <ShieldCheck className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-500">{activeClients} Active</div>
          <p className="text-[11px] text-muted-foreground">
            {totalClients - activeClients} suspended / inactive
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">AI Modules Activated</span>
            <Sparkles className="size-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-purple-400">{aiEnabledCount} Clients</div>
          <p className="text-[11px] text-muted-foreground">Backend-granted access</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Global Contacts</span>
            <Users className="size-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-blue-400">{totalContacts}</div>
          <p className="text-[11px] text-muted-foreground">Across all client companies</p>
        </div>
      </div>

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company or email..."
            className="pl-9 h-9 text-xs bg-muted/50 border-border"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAccounts}
            disabled={loading}
            className="h-9 border-border"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs shadow-sm"
          >
            <Plus className="size-4 mr-1.5" />
            Provision Client Account
          </Button>
        </div>
      </div>

      {/* Accounts Directory */}
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs font-semibold">Client Company</TableHead>
              <TableHead className="text-xs font-semibold">Owner Admin</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">AI Features</TableHead>
              <TableHead className="text-xs font-semibold">WhatsApp Campaigns</TableHead>
              <TableHead className="text-xs font-semibold text-center">Team / Leads</TableHead>
              <TableHead className="text-xs font-semibold text-right">Super Admin Control</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin mx-auto text-primary" />
                  <p className="text-xs text-muted-foreground mt-2">Loading client accounts...</p>
                </TableCell>
              </TableRow>
            ) : filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                  No client accounts found. Click &quot;Provision Client Account&quot; to onboard your first business!
                </TableCell>
              </TableRow>
            ) : (
              filteredAccounts.map((account) => (
                <TableRow key={account.id} className="border-border hover:bg-muted/30">
                  <TableCell>
                    <div className="font-medium text-sm text-foreground">{account.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      ID: {account.id.slice(0, 8)}... · {new Date(account.created_at).toLocaleDateString()}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-xs font-medium text-foreground">{account.owner_name}</div>
                    <div className="text-[11px] text-muted-foreground">{account.owner_email}</div>
                  </TableCell>

                  <TableCell>
                    {account.is_active ? (
                      <Badge variant="outline" className="text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        <CheckCircle2 className="size-3 mr-1" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px] font-medium bg-red-500/10 text-red-500 border-red-500/20">
                        <XCircle className="size-3 mr-1" /> Suspended
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      {account.ai_enabled ? (
                        <Badge variant="outline" className="text-[11px] font-medium bg-purple-500/10 text-purple-400 border-purple-500/20">
                          <Sparkles className="size-3 mr-1" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground border-border">
                          Disabled
                        </Badge>
                      )}
                      <Button
                        variant={account.ai_enabled ? "outline" : "secondary"}
                        size="sm"
                        disabled={actionId === account.id}
                        onClick={() => toggleAiStatus(account)}
                        className={`h-6 text-[11px] px-2 ${
                          account.ai_enabled ? 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10' : ''
                        }`}
                        title={account.ai_enabled ? 'Revoke AI Access' : 'Grant AI Access'}
                      >
                        {account.ai_enabled ? 'Revoke' : 'Grant'}
                      </Button>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      {account.broadcasts_enabled ? (
                        <Badge variant="outline" className="text-[11px] font-medium bg-blue-500/10 text-blue-400 border-blue-500/20">
                          <Radio className="size-3 mr-1" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] font-medium text-amber-500/80 border-amber-500/20">
                          <Lock className="size-3 mr-1" /> Locked
                        </Badge>
                      )}
                      <Button
                        variant={account.broadcasts_enabled ? "outline" : "secondary"}
                        size="sm"
                        disabled={actionId === account.id}
                        onClick={() => toggleBroadcastStatus(account)}
                        className={`h-6 text-[11px] px-2 ${
                          account.broadcasts_enabled ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10' : ''
                        }`}
                        title={account.broadcasts_enabled ? 'Lock Campaigns' : 'Unlock Campaigns'}
                      >
                        {account.broadcasts_enabled ? 'Lock' : 'Unlock'}
                      </Button>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <span className="text-xs text-foreground font-medium">
                      {account.members_count} agents
                    </span>
                    <span className="text-muted-foreground text-xs"> · </span>
                    <span className="text-xs text-muted-foreground">
                      {account.contacts_count} leads
                    </span>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Setup AI Agent Shortcut */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actionId === account.id}
                        onClick={() => handleSwitchWorkspace(account, '/agents')}
                        className="h-7 text-xs px-2.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
                        title="Enter workspace and configure managed AI agent prompt & LLM"
                      >
                        <Wrench className="size-3 mr-1" />
                        Setup AI
                      </Button>

                      {/* Enter Workspace Button */}
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={actionId === account.id}
                        onClick={() => handleSwitchWorkspace(account, '/dashboard')}
                        className="h-7 text-xs px-2.5 font-medium"
                        title="Impersonate & manage this client workspace"
                      >
                        <LogIn className="size-3 mr-1" />
                        Enter
                      </Button>

                      {/* Suspend / Activate Toggle */}
                      <Button
                        variant={account.is_active ? "destructive" : "default"}
                        size="sm"
                        disabled={actionId === account.id}
                        onClick={() => toggleAccountStatus(account)}
                        className="h-7 text-xs px-2"
                      >
                        {account.is_active ? 'Suspend' : 'Activate'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Provisioning Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Building2 className="size-5 text-primary" />
              Provision New Client Company
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a dedicated workspace for your client and provision their primary administrator.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAccount} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Client Company Name *</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Apex Global Realty"
                required
                className="h-8 text-xs bg-muted/50 border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Admin Full Name</Label>
                <Input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="h-8 text-xs bg-muted/50 border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Admin Email *</Label>
                <Input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="admin@apex.com"
                  required
                  className="h-8 text-xs bg-muted/50 border-border"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Initial Password *</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set a secure temporary password"
                required
                minLength={6}
                className="h-8 text-xs bg-muted/50 border-border"
              />
            </div>

            {/* AI Control in Provisioning */}
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-purple-400" />
                  <span className="text-xs font-semibold text-foreground">AI Features Add-on</span>
                </div>
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                  className="rounded border-border accent-primary cursor-pointer size-4"
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-normal">
                Enable smart auto-reply, AI embeddings, and conversational assistance for this client. You alone can configure their system prompt.
              </p>
            </div>

            {/* WhatsApp Broadcasts in Provisioning */}
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Radio className="size-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-foreground">WhatsApp Campaigns Add-on</span>
                </div>
                <input
                  type="checkbox"
                  checked={broadcastsEnabled}
                  onChange={(e) => setBroadcastsEnabled(e.target.checked)}
                  className="rounded border-border accent-primary cursor-pointer size-4"
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-normal">
                Allow this client to send bulk WhatsApp campaigns and broadcast messages to audience segments.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creating}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
              >
                {creating ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                Provision Client Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
