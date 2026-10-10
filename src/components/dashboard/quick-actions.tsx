"use client"

import Link from 'next/link'
import { UserPlus, Briefcase, Radio, Zap, ArrowRight } from 'lucide-react'
import type { ComponentType } from 'react'

import { useTranslations } from 'next-intl'

// Quick-action shortcuts. Each navigates to the page that owns the
// relevant "create" flow. We deliberately don't try to auto-open any
// modal on the target page — that'd require touching those pages,
// which is out of scope here.
interface Action {
  labelKey: string
  descKey: string
  href: string
  icon: ComponentType<{ className?: string }>
  gradient: string
  iconColor: string
}

const ACTIONS: Action[] = [
  {
    labelKey: 'newContact',
    descKey: 'newContactDesc',
    href: '/contacts',
    icon: UserPlus,
    gradient: 'from-primary/20 to-primary/5',
    iconColor: 'text-primary bg-primary/15',
  },
  {
    labelKey: 'newDeal',
    descKey: 'newDealDesc',
    href: '/pipelines',
    icon: Briefcase,
    gradient: 'from-blue-500/20 to-blue-500/5',
    iconColor: 'text-blue-400 bg-blue-500/15',
  },
  {
    labelKey: 'newBroadcast',
    descKey: 'newBroadcastDesc',
    href: '/broadcasts/new',
    icon: Radio,
    gradient: 'from-amber-500/20 to-amber-500/5',
    iconColor: 'text-amber-400 bg-amber-500/15',
  },
  {
    labelKey: 'newAutomation',
    descKey: 'newAutomationDesc',
    href: '/automations/new',
    icon: Zap,
    gradient: 'from-rose-500/20 to-rose-500/5',
    iconColor: 'text-rose-400 bg-rose-500/15',
  },
]

export function QuickActions() {
  const t = useTranslations('Dashboard.quickActions')

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map((a) => {
        const Icon = a.icon
        return (
          <Link
            key={a.href}
            href={a.href}
            className={`group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-gradient-to-br ${a.gradient} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-lg hover:shadow-black/10`}
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${a.iconColor} transition-transform duration-200 group-hover:scale-110`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex items-end justify-between gap-2">
              <span className="text-sm font-semibold text-foreground leading-tight">
                {t(a.labelKey as string)}
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
