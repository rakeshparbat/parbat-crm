'use client';

// ============================================================
// LeadSourcesSettings — Settings → Lead Sources
//
// Three collapsible configuration cards:
//   1. Meta Lead Ads     — Page ID + encrypted Page Access Token
//   2. Google Ads Leads  — Webhook key + generated webhook URL
//   3. Website Leads     — API key selector + embeddable snippet
//
// Admin+ can save / delete configs. Any member can view the panel
// (consistent with the rest of the settings panels).
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  Globe,
  Search,
  ChevronRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { SettingsPanelHead } from './settings-panel-head';
import { RequireRole } from '@/components/auth/require-role';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={handleCopy}
      className="gap-1.5 shrink-0"
      aria-label={label}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

function MaskedInput({
  value,
  onChange,
  placeholder,
  id,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="relative flex items-center">
      <Input
        id={id}
        type={revealed ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-10"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="absolute right-2.5 text-muted-foreground hover:text-foreground"
        onClick={() => setRevealed((r) => !r)}
        aria-label={revealed ? 'Hide value' : 'Show value'}
        tabIndex={-1}
      >
        {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

// ─── Meta Lead Ads ────────────────────────────────────────────────────────────

interface MetaConfig {
  id: string;
  page_id: string;
  label: string;
  created_at: string;
}

function MetaLeadSection({ accountId, canEdit }: { accountId: string; canEdit: boolean }) {
  const supabase = createClient();
  const [configs, setConfigs] = useState<MetaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [pageId, setPageId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [label, setLabel] = useState('Meta Lead Ads');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('meta_lead_configs')
      .select('id, page_id, label, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load Meta configs');
    else setConfigs(data ?? []);
    setLoading(false);
  }, [accountId, supabase]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!pageId.trim() || !accessToken.trim() || !verifyToken.trim()) {
      toast.error('Page ID, Access Token, and Verify Token are all required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/leads/meta/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          page_id: pageId.trim(),
          page_access_token: accessToken.trim(),
          verify_token: verifyToken.trim(),
          label: label.trim() || 'Meta Lead Ads',
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Save failed');
      }
      toast.success('Meta Lead Ads config saved');
      setShowDialog(false);
      resetForm();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase
      .from('meta_lead_configs')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);
    if (error) toast.error('Failed to delete config');
    else { toast.success('Config removed'); await load(); }
    setDeleting(null);
  };

  const resetForm = () => {
    setPageId(''); setAccessToken(''); setVerifyToken('');
    setLabel('Meta Lead Ads');
  };

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/leads/meta`
    : '/api/leads/meta';

  return (
    <div className="space-y-4">
      {/* Setup instructions */}
      <Alert>
        <AlertDescription className="text-sm space-y-1">
          <p>
            <strong>Step 1 —</strong> In Meta Business Suite, open your Page → <em>Instant Forms</em> → <em>Integrations</em> → <em>Webhooks</em>.
          </p>
          <p>
            <strong>Step 2 —</strong> Subscribe to the <code className="bg-muted px-1 py-0.5 rounded text-xs">leadgen</code> field with the URL below and your verify token.
          </p>
          <p>
            <strong>Step 3 —</strong> Add the config below with your Page Access Token.
          </p>
        </AlertDescription>
      </Alert>

      {/* Webhook URL */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Webhook URL</Label>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono break-all">
            {webhookUrl}
          </code>
          <CopyButton value={webhookUrl} label="Copy URL" />
        </div>
      </div>

      {/* Existing configs */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : configs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No pages connected yet.</p>
      ) : (
        <div className="space-y-2">
          {configs.map((cfg) => (
            <div
              key={cfg.id}
              className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{cfg.label}</p>
                <p className="text-xs text-muted-foreground">Page ID: {cfg.page_id}</p>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  disabled={deleting === cfg.id}
                  onClick={() => handleDelete(cfg.id)}
                  aria-label="Remove this Meta config"
                >
                  {deleting === cfg.id
                    ? <Loader2 className="size-4 animate-spin" />
                    : <Trash2 className="size-4" />}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowDialog(true)}
          id="meta-leads-add-page"
        >
          <Plus className="size-4" /> Add Facebook Page
        </Button>
      )}

      {/* Add-config dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) resetForm(); setShowDialog(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect a Facebook Page</DialogTitle>
            <DialogDescription>
              Leads submitted on this page&apos;s Instant Forms will be added to your contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="meta-label">Label (for your reference)</Label>
              <Input id="meta-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Meta Lead Ads" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-page-id">Facebook Page ID</Label>
              <Input id="meta-page-id" value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="123456789012345" />
              <p className="text-xs text-muted-foreground">Found under Page Settings → Page Info → Page ID</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-access-token">Page Access Token</Label>
              <MaskedInput id="meta-access-token" value={accessToken} onChange={setAccessToken} placeholder="EAAGm0…" />
              <p className="text-xs text-muted-foreground">
                Generate in <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Graph API Explorer</a> with <code className="bg-muted px-1 rounded text-[11px]">pages_manage_ads</code> permission.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-verify-token">Verify Token</Label>
              <Input id="meta-verify-token" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} placeholder="my-secret-verify-token" />
              <p className="text-xs text-muted-foreground">Any string you choose — paste the same value in the Meta webhook setup.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowDialog(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} id="meta-leads-save-btn">
              {saving ? <><Loader2 className="size-4 animate-spin mr-2" />Saving…</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Google Leads ─────────────────────────────────────────────────────────────

interface GoogleConfig {
  id: string;
  label: string;
  webhook_key: string;
  created_at: string;
}

function GoogleLeadSection({ accountId, canEdit }: { accountId: string; canEdit: boolean }) {
  const supabase = createClient();
  const [config, setConfig] = useState<GoogleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showKeyFull, setShowKeyFull] = useState(false);

  // Form
  const [webhookKey, setWebhookKey] = useState('');
  const [label, setLabel] = useState('Google Lead Forms');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('google_lead_configs')
      .select('id, label, webhook_key, created_at')
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) toast.error('Failed to load Google config');
    else setConfig(data ?? null);
    setLoading(false);
  }, [accountId, supabase]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!webhookKey.trim()) {
      toast.error('Webhook key is required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('google_lead_configs')
        .upsert(
          {
            account_id: accountId,
            webhook_key: webhookKey.trim(),
            label: label.trim() || 'Google Lead Forms',
          },
          { onConflict: 'account_id' }
        );
      if (error) throw new Error(error.message);
      toast.success('Google Lead config saved');
      setWebhookKey('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!config) return;
    setDeleting(true);
    const { error } = await supabase
      .from('google_lead_configs')
      .delete()
      .eq('id', config.id)
      .eq('account_id', accountId);
    if (error) toast.error('Failed to delete config');
    else { toast.success('Google config removed'); setConfig(null); }
    setDeleting(false);
  };

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/leads/google`
    : '/api/leads/google';

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-sm space-y-1">
          <p>
            <strong>Step 1 —</strong> In Google Ads, open <em>Tools &amp; Settings → Lead forms → Delivery</em>.
          </p>
          <p>
            <strong>Step 2 —</strong> Select <em>Webhook</em> and paste the URL below. Google will give you a Webhook Key — paste it here.
          </p>
          <p>
            <strong>Step 3 —</strong> Click <em>Send test data</em> in Google Ads to verify the connection.
          </p>
        </AlertDescription>
      </Alert>

      {/* Webhook URL */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Your Webhook URL</Label>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono break-all">
            {webhookUrl}
          </code>
          <CopyButton value={webhookUrl} label="Copy URL" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : config ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">{config.label}</p>
              <p className="text-xs text-muted-foreground font-mono">
                Key: {showKeyFull ? config.webhook_key : config.webhook_key.slice(0, 8) + '••••••••'}
                <button
                  type="button"
                  className="ml-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKeyFull((s) => !s)}
                  aria-label={showKeyFull ? 'Hide key' : 'Show key'}
                >
                  {showKeyFull ? <EyeOff className="inline size-3.5" /> : <Eye className="inline size-3.5" />}
                </button>
              </p>
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                disabled={deleting}
                onClick={handleDelete}
                aria-label="Remove Google config"
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {canEdit && !config && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-1.5">
            <Label htmlFor="google-label">Label</Label>
            <Input id="google-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Google Lead Forms" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="google-webhook-key">Webhook Key (from Google Ads)</Label>
            <MaskedInput id="google-webhook-key" value={webhookKey} onChange={setWebhookKey} placeholder="Paste the key Google Ads gives you" />
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            id="google-leads-save-btn"
          >
            {saving ? <><Loader2 className="size-4 animate-spin mr-2" />Saving…</> : 'Save Google config'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Website Leads ────────────────────────────────────────────────────────────

function WebsiteLeadSection({ accountId, canEdit }: { accountId: string; canEdit: boolean }) {
  const [snippet, setSnippet] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/leads/website`
    : '/api/leads/website';

  const generateSnippet = (key: string) => {
    return `<!-- Universal Website Lead Form & UTM Tracker -->
<script>
(function() {
  const WACRM_API = '${webhookUrl}';
  const WACRM_KEY = '${key}';

  // Helper to extract UTM parameters from current URL
  function getUtmParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || 'website',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_term: params.get('utm_term') || '',
      utm_content: params.get('utm_content') || '',
      landing_page_url: window.location.href,
    };
  }

  // Universal submit function — can be called manually or by form listener
  window.wacrmSubmitLead = function(data) {
    const payload = Object.assign({}, getUtmParams(), data, {
      source_url: window.location.href
    });

    return fetch(WACRM_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + WACRM_KEY,
      },
      body: JSON.stringify(payload),
    }).then(function(r) { return r.json(); });
  };

  // Auto-bind to ALL forms with attribute data-wacrm-form OR id/class wacrm-lead-form
  document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('form[data-wacrm-form], #wacrm-lead-form, .wacrm-lead-form');
    forms.forEach(function(form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        const fd = new FormData(form);
        const formTag = form.getAttribute('data-wacrm-form') || 'web-form';

        window.wacrmSubmitLead({
          phone: fd.get('phone') || fd.get('tel') || fd.get('mobile'),
          name: fd.get('name') || fd.get('full_name'),
          email: fd.get('email'),
          company: fd.get('company'),
          message: fd.get('message') || fd.get('comment') || fd.get('note'),
          extraTags: [formTag],
        }).then(function(r) {
          if (r && r.contact_id) {
            const redirect = form.getAttribute('data-wacrm-redirect');
            if (redirect) {
              window.location.href = redirect;
            } else {
              alert('Thank you! Your inquiry has been received.');
              form.reset();
            }
          }
        }).catch(function(err) {
          console.error('[CRM Lead Error]', err);
        });
      });
    });
  });
})();
</script>

<!-- Example: Works on multiple forms anywhere on your website -->
<!-- Form 1: Contact Us -->
<form data-wacrm-form="contact-page" data-wacrm-redirect="/thank-you">
  <input name="name" placeholder="Full Name" type="text" required />
  <input name="phone" placeholder="+1234567890" type="tel" required />
  <input name="email" placeholder="Email" type="email" />
  <textarea name="message" placeholder="Message"></textarea>
  <button type="submit">Submit Inquiry</button>
</form>`;
  };

  const handleGenerate = () => {
    if (!apiKey.trim()) {
      toast.error('Paste your API key first (generate one under Settings → API keys)');
      return;
    }
    setSnippet(generateSnippet(apiKey.trim()));
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-sm space-y-1">
          <p>
            <strong>Step 1 —</strong> Go to <strong>Settings → API keys</strong> and create a key with the <code className="bg-muted px-1 rounded text-[11px]">contacts:write</code> scope.
          </p>
          <p>
            <strong>Step 2 —</strong> Paste the key below to generate your embed snippet.
          </p>
          <p>
            <strong>Step 3 —</strong> Copy the snippet and add it to any page of your website.
          </p>
        </AlertDescription>
      </Alert>

      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="website-api-key">Your API Key (contacts:write)</Label>
          <MaskedInput
            id="website-api-key"
            value={apiKey}
            onChange={setApiKey}
            placeholder="wacrm_live_…"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleGenerate}
          disabled={!apiKey.trim()}
          id="website-leads-generate-btn"
        >
          Generate snippet
        </Button>
      </div>

      {snippet && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Embed Snippet</Label>
            <CopyButton value={snippet} label="Copy snippet" />
          </div>
          <pre className="rounded-lg border bg-muted/50 p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {snippet}
          </pre>
          <p className="text-xs text-muted-foreground">
            The snippet auto-attaches to <code className="bg-muted px-1 rounded">id=&quot;wacrm-lead-form&quot;</code> or you can call <code className="bg-muted px-1 rounded">window.wacrmSubmitLead(data)</code> from your own JS.
          </p>
        </div>
      )}

      {/* REST reference */}
      <details className="group text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1.5 select-none">
          <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
          Direct API reference
        </summary>
        <div className="mt-3 rounded-lg border bg-muted/30 p-4 space-y-2">
          <p className="text-xs text-muted-foreground font-mono">POST {webhookUrl}</p>
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">{`Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "phone":      "+14155550100",  // required, E.164
  "name":       "Jane Doe",
  "email":      "jane@example.com",
  "company":    "Acme Inc",
  "message":    "I'd like a demo",
  "source_url": "https://your-site.com/contact"
}`}</pre>
        </div>
      </details>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function LeadSourcesSettings() {
  const { accountId, canEditSettings } = useAuth();

  if (!accountId) return null;

  return (
    <div className="space-y-6">
      <SettingsPanelHead
        title="Lead Sources"
        description="Connect Meta Lead Ads, Google Ads, and your website to automatically capture leads as contacts."
      />

      <Accordion multiple defaultValue={['meta', 'google', 'website']} className="space-y-3">
        {/* ── Meta ── */}
        <AccordionItem value="meta" className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              {/* Meta wordmark-ish icon */}
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#1877F2]/10">
                <svg viewBox="0 0 24 24" className="size-5 fill-[#1877F2]" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.46 6c-.77.35-1.6.58-2.46.67.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Meta Lead Ads</p>
                <p className="text-xs text-muted-foreground">Facebook &amp; Instagram Instant Forms</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <MetaLeadSection accountId={accountId} canEdit={!!canEditSettings} />
          </AccordionContent>
        </AccordionItem>

        {/* ── Google ── */}
        <AccordionItem value="google" className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#4285F4]/10">
                <svg viewBox="0 0 24 24" className="size-5" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Google Ads Leads</p>
                <p className="text-xs text-muted-foreground">Lead Form Extensions</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <GoogleLeadSection accountId={accountId} canEdit={!!canEditSettings} />
          </AccordionContent>
        </AccordionItem>

        {/* ── Website ── */}
        <AccordionItem value="website" className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Globe className="size-4.5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Website Leads</p>
                <p className="text-xs text-muted-foreground">Embed form or call the REST API</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <WebsiteLeadSection accountId={accountId} canEdit={!!canEditSettings} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
