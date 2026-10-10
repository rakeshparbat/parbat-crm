import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  /** Pre-formatted value for display (e.g. "42" or "$1,250"). */
  value: string
  icon: ComponentType<{ className?: string }>
  /**
   * Delta-mode secondary row: arrow + delta text. Omit when the metric
   * doesn't have a sensible comparison (e.g. total pipeline value).
   */
  delta?: {
    /** Positive / negative / zero drives arrow + color. */
    sign: number
    /** Pre-formatted delta, e.g. "+3 vs yesterday". */
    label: string
  }
  /** Used instead of `delta` when the metric has a static subtitle. */
  subtitle?: string
  /** Optional accent color class applied to the icon bg + left border strip. */
  accentClass?: string
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  delta,
  subtitle,
  accentClass = 'bg-primary/10 text-primary border-primary/40',
}: MetricCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-border/80 hover:shadow-md hover:shadow-black/10">
      {/* Left accent strip */}
      <div className={cn('absolute inset-y-0 left-0 w-0.5', accentClass.split(' ').find(c => c.startsWith('border-')) ? '' : 'bg-primary/60')} />

      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105',
              accentClass.split(' ').filter(c => !c.startsWith('border-')).join(' '),
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <p className="mt-3 text-[30px] leading-none font-bold tabular-nums text-foreground tracking-tight">
          {value}
        </p>

        <div className="mt-2 h-px w-full bg-border/50" />

        <div className="mt-2">
          {delta ? (
            <DeltaRow sign={delta.sign} label={delta.label} />
          ) : subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DeltaRow({ sign, label }: { sign: number; label: string }) {
  const tone =
    sign > 0
      ? 'text-emerald-400'
      : sign < 0
      ? 'text-rose-400'
      : 'text-muted-foreground'
  const bgTone =
    sign > 0
      ? 'bg-emerald-500/10'
      : sign < 0
      ? 'bg-rose-500/10'
      : 'bg-muted/60'
  const Arrow = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', tone, bgTone)}>
      <Arrow className="h-3 w-3" aria-hidden />
      <span className="tabular-nums">{label}</span>
    </div>
  )
}
