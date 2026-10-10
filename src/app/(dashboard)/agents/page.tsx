'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, Sparkles, Settings2, BarChart3 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AiPlayground } from '@/components/agents/ai-playground';
import { AiUsageCard } from '@/components/agents/ai-usage';
import { AiConfig } from '@/components/settings/ai-config';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';

type Tab = 'playground' | 'setup' | 'usage';

export default function AgentsPage() {
  const t = useTranslations('Agents');
  const { accountRole, isAiEnabled, isSuperAdmin } = useAuth();
  const canViewUsage = accountRole ? canEditSettings(accountRole) : false;
  const [tab, setTab] = useState<Tab>('playground');
  const [decided, setDecided] = useState(false);

  // Land first-time users on Playground for clients, Setup for Super Admin if unconfigured.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/config');
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (isSuperAdmin && !data?.configured) {
            setTab('setup');
          } else {
            setTab('playground');
          }
        }
      } catch {
        if (!cancelled) setTab('playground');
      } finally {
        if (!cancelled) setDecided(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  if (!isAiEnabled && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center max-w-lg mx-auto space-y-4">
        <div className="size-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
          <Sparkles className="size-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Managed AI Agent Module</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Intelligent WhatsApp Auto-Reply, Smart Customer Qualification, and Knowledge Base support are an exclusive enterprise add-on. Contact your Antigravity platform administrator to activate and configure your AI Agent.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t('title')}
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>

        {!isSuperAdmin && (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 text-xs font-medium">
            Managed Service Active 🟢
          </span>
        )}
      </div>

      {decided && (
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="mt-6"
        >
          <TabsList>
            <TabsTrigger value="playground">
              <Sparkles className="mr-1.5 h-4 w-4" /> {t('tabPlayground')}
            </TabsTrigger>

            {/* ONLY Super Admin can see and edit the raw AI Setup / Prompts / Credentials */}
            {isSuperAdmin ? (
              <TabsTrigger value="setup">
                <Settings2 className="mr-1.5 h-4 w-4" /> Setup & Prompt Engineering
              </TabsTrigger>
            ) : (
              <TabsTrigger value="setup">
                <Bot className="mr-1.5 h-4 w-4" /> Agent Status
              </TabsTrigger>
            )}

            {canViewUsage && (
              <TabsTrigger value="usage">
                <BarChart3 className="mr-1.5 h-4 w-4" /> {t('tabUsage')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="playground" className="mt-4">
            <AiPlayground onGoToSetup={() => setTab('setup')} />
          </TabsContent>

          <TabsContent value="setup" className="mt-4">
            {isSuperAdmin ? (
              <AiConfig />
            ) : (
              <div className="rounded-xl border border-border/80 bg-card p-6 space-y-4 max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Dedicated Managed AI Agent</h3>
                    <p className="text-xs text-muted-foreground">Maintained by Antigravity AI Engineering</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                  <p>
                    Your conversational AI agent is custom-tuned with dedicated business instructions, response guards, and WhatsApp automation rules.
                  </p>
                  <p>
                    Prompt engineering, provider API keys, and knowledge base vector embeddings are securely maintained by your platform administrator so your assistant performs reliably without manual tuning.
                  </p>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>To request knowledge base updates or prompt changes:</span>
                  <span className="font-semibold text-primary">Contact Support</span>
                </div>
              </div>
            )}
          </TabsContent>

          {canViewUsage && (
            <TabsContent value="usage" className="mt-4">
              <AiUsageCard />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
