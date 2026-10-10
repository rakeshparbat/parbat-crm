"use client"

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/currency'
import {
  MessageSquare,
  UserPlus,
  DollarSign,
  Send,
  RefreshCw,
  TrendingUp,
  Trophy,
  Radio,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

import {
  loadActivity,
  loadConversationsSeries,
  loadMetrics,
  loadPipelineDonut,
  loadResponseTime,
} from '@/lib/dashboard/queries'
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  MetricsBundle,
  PipelineDonutData,
  ResponseTimeSummary,
} from '@/lib/dashboard/types'

import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { ConversationsChart } from '@/components/dashboard/conversations-chart'
import { PipelineDonut } from '@/components/dashboard/pipeline-donut'
import { ResponseTimeChart } from '@/components/dashboard/response-time-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'

import { useTranslations } from 'next-intl'

type RangeDays = 7 | 30 | 90

export default function DashboardPage() {
  const t = useTranslations('Dashboard.page')
  const { defaultCurrency } = useAuth()
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const [range, setRange] = useState<RangeDays>(30)
  // Keep a cache per range so switching tabs doesn't re-fetch what we
  // already have. Ranges the user hasn't opened yet stay null and
  // trigger a fetch on first view.
  const [series, setSeries] = useState<Record<RangeDays, ConversationsSeriesPoint[] | null>>({
    7: null,
    30: null,
    90: null,
  })
  const [seriesLoading, setSeriesLoading] = useState(true)

  const [pipeline, setPipeline] = useState<PipelineDonutData | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(true)

  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(null)
  const [responseTimeLoading, setResponseTimeLoading] = useState(true)

  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

  const [refreshing, setRefreshing] = useState(false)

  const loadAll = useCallback(() => {
    const db = createClient()

    // Kick everything off in parallel. Each block has its own
    // setState + finally so a slow query doesn't hold up faster
    // sections — each widget shows its own skeleton independently.
    void loadMetrics(db)
      .then((m) => setMetrics(m))
      .catch((err) => console.error('[dashboard] metrics failed:', err))
      .finally(() => setMetricsLoading(false))

    void loadConversationsSeries(db, 30)
      .then((s) => setSeries((prev) => ({ ...prev, 30: s })))
      .catch((err) => console.error('[dashboard] series failed:', err))
      .finally(() => setSeriesLoading(false))

    void loadPipelineDonut(db)
      .then((p) => setPipeline(p))
      .catch((err) => console.error('[dashboard] pipeline failed:', err))
      .finally(() => setPipelineLoading(false))

    void loadResponseTime(db)
      .then((r) => setResponseTime(r))
      .catch((err) => console.error('[dashboard] response time failed:', err))
      .finally(() => setResponseTimeLoading(false))

    // Fetch up to 50 so the biggest page-size option in the feed
    // (50 rows) is already in memory — switching sizes then becomes
    // a pure client-side slice with no extra round trip.
    void loadActivity(db, 50)
      .then((a) => setActivity(a))
      .catch((err) => console.error('[dashboard] activity failed:', err))
      .finally(() => setActivityLoading(false))
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Range switch handler — kept in an event callback (not an effect)
  // so the setState calls stay out of the react-hooks/set-state-in-effect
  // rule's way. The cached bucket check means switching back to a
  // previously-viewed range is instant and doesn't re-fetch.
  const handleRangeChange = useCallback(
    (r: RangeDays) => {
      setRange(r)
      if (series[r] !== null) return
      setSeriesLoading(true)
      const db = createClient()
      loadConversationsSeries(db, r)
        .then((s) => setSeries((prev) => ({ ...prev, [r]: s })))
        .catch((err) => console.error('[dashboard] series failed:', err))
        .finally(() => setSeriesLoading(false))
    },
    [series],
  )

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    // Reset loading states
    setMetricsLoading(true)
    setSeriesLoading(true)
    setPipelineLoading(true)
    setResponseTimeLoading(true)
    setActivityLoading(true)
    // Reset cache so all ranges re-fetch
    setSeries({ 7: null, 30: null, 90: null })
    setRange(30)
    loadAll()
    setTimeout(() => setRefreshing(false), 800)
  }, [loadAll])

  // Today's date formatted nicely for the header
  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date())

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {t('title')}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground pl-9">
            {todayLabel} &middot; {t('description')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          aria-label="Refresh dashboard"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border/80 hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsLoading || !metrics ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              title={t('activeConversations')}
              value={metrics.activeConversations.current.toLocaleString()}
              icon={MessageSquare}
              accentClass="bg-blue-500/10 text-blue-400"
              delta={{
                sign: metrics.activeConversations.previous,
                label: deltaLabel(
                  metrics.activeConversations.previous,
                  t('newTodayVsYesterday'),
                  t('noChange', { suffix: t('newTodayVsYesterday') })
                ),
              }}
            />
            <MetricCard
              title={t('newContactsToday')}
              value={metrics.newContactsToday.current.toLocaleString()}
              icon={UserPlus}
              accentClass="bg-primary/10 text-primary"
              delta={{
                sign:
                  metrics.newContactsToday.current - metrics.newContactsToday.previous,
                label: deltaLabel(
                  metrics.newContactsToday.current - metrics.newContactsToday.previous,
                  t('vsYesterday'),
                  t('noChange', { suffix: t('vsYesterday') })
                ),
              }}
            />
            <MetricCard
              title={t('openDealsValue')}
              value={formatCurrency(metrics.openDealsValue, defaultCurrency)}
              icon={DollarSign}
              accentClass="bg-emerald-500/10 text-emerald-400"
              subtitle={t('openDeals', { count: metrics.openDealsCount })}
            />
            <MetricCard
              title={t('messagesSentToday')}
              value={metrics.messagesSentToday.current.toLocaleString()}
              icon={Send}
              accentClass="bg-amber-500/10 text-amber-400"
              delta={{
                sign:
                  metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
                label: deltaLabel(
                  metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
                  t('vsYesterday'),
                  t('noChange', { suffix: t('vsYesterday') })
                ),
              }}
            />
          </>
        )}
      </div>

      {/* ── India CRM Insights ── */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">🇮🇳 India CRM Insights</span>
          <div className="flex-1 border-t border-border" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricsLoading || !metrics ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              {/* WhatsApp Response Rate */}
              <div className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:shadow-md hover:shadow-black/10">
                <div className="absolute inset-y-0 left-0 w-0.5 bg-green-500/70" />
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response Rate</p>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    </div>
                  </div>
                  <p className="mt-3 text-[30px] leading-none font-bold tabular-nums text-foreground tracking-tight">
                    {metrics.whatsappResponseRate}%
                  </p>
                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all duration-700"
                      style={{ width: `${metrics.whatsappResponseRate}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">WhatsApp replies today</p>
                </div>
              </div>

              {/* Deals Won This Month */}
              <MetricCard
                title="Won This Month"
                value={formatCurrency(metrics.dealsWonThisMonth, defaultCurrency)}
                icon={Trophy}
                accentClass="bg-yellow-500/10 text-yellow-400"
                subtitle={`${metrics.dealsWonThisMonthCount} deal${metrics.dealsWonThisMonthCount !== 1 ? 's' : ''} closed won`}
              />

              {/* Broadcast Reach Today */}
              <MetricCard
                title="Broadcast Reach"
                value={metrics.broadcastReachToday.toLocaleString('en-IN')}
                icon={Radio}
                accentClass="bg-purple-500/10 text-purple-400"
                subtitle="recipients reached today"
              />

              {/* Conversations Expiring Soon */}
              <div className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:shadow-md hover:shadow-black/10">
                <div className={`absolute inset-y-0 left-0 w-0.5 ${metrics.conversationsExpiringSoon > 0 ? 'bg-rose-500' : 'bg-muted-foreground/30'}`} />
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Window Expiring</p>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${metrics.conversationsExpiringSoon > 0 ? 'bg-rose-500/10' : 'bg-muted'}`}>
                      <AlertTriangle className={`h-4 w-4 ${metrics.conversationsExpiringSoon > 0 ? 'text-rose-400' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                  <p className={`mt-3 text-[30px] leading-none font-bold tabular-nums tracking-tight ${metrics.conversationsExpiringSoon > 0 ? 'text-rose-400' : 'text-foreground'}`}>
                    {metrics.conversationsExpiringSoon}
                  </p>
                  <div className="mt-2 h-px w-full bg-border/50" />
                  <div className="mt-2">
                    {metrics.conversationsExpiringSoon > 0 ? (
                      <div className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400">
                        <AlertTriangle className="h-3 w-3" />
                        Reply before 24h window closes
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No expiring conversations</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>


      {/* ── Quick actions ── */}
      <QuickActions />

      {/* ── Charts row ── */}
      {/* items-stretch (the grid default) stretches the two columns to
          match the tallest sibling; adding h-full on each wrapper and
          on the inner panels makes both cards actually fill that
          stretched height so their rounded borders line up. Without
          this, the pipeline card rendered at its natural (shorter)
          height while the line chart drove the row height. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="h-full lg:col-span-3">
          <ConversationsChart
            series={series}
            loading={seriesLoading}
            range={range}
            onRangeChange={handleRangeChange}
          />
        </div>
        <div className="h-full lg:col-span-2">
          <PipelineDonut
            data={pipeline}
            loading={pipelineLoading}
            currency={defaultCurrency}
          />
        </div>
      </div>

      {/* ── Response time ── */}
      <ResponseTimeChart data={responseTime} loading={responseTimeLoading} />

      {/* ── Activity feed ── */}
      <ActivityFeed items={activity} loading={activityLoading} />
    </div>
  )
}

// ------------------------------------------------------------

function deltaLabel(delta: number, suffix: string, noChangeLabel: string): string {
  if (delta === 0) return noChangeLabel
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toLocaleString()} ${suffix}`
}
