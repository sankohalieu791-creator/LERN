'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getOpsOverviewCounts } from '@/lib/supabase'
import { Building2, Flag, ShieldAlert, ClipboardList } from 'lucide-react'

const CARDS = [
  { key: 'employers_pending', label: 'Employers pending verification', href: '/ops/employers', icon: Building2 },
  { key: 'reports_pending', label: 'Content reports awaiting review', href: '/ops/reports', icon: Flag },
  { key: 'concerns_open', label: 'Safeguarding concerns open', href: '/ops/concerns', icon: ShieldAlert },
  { key: 'dbs_attention', label: 'DBS attention needed', href: '/ops/dbs', icon: ClipboardList },
] as const

export default function OpsOverviewPage() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    getOpsOverviewCounts().then(({ data }) => setCounts(data as any))
  }, [])

  return (
    <div className="max-w-3xl">
      <p className="text-[22px] font-bold text-ink mb-1">Overview</p>
      <p className="text-[14px] text-ink-tertiary mb-6">LERN's own internal tool. Not visible to any school, college, provider, employer or student.</p>

      <div className="grid grid-cols-2 gap-4">
        {CARDS.map(c => {
          const Icon = c.icon
          const count = counts?.[c.key] ?? null
          const urgent = count !== null && count > 0
          return (
            <Link
              key={c.key} href={c.href}
              className={`bg-surface border rounded-2xl p-5 hover:border-brand transition ${urgent ? 'border-[#F3C9BC]' : 'border-edge'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className="w-5 h-5 text-ink-tertiary" />
                {urgent && <span className="w-2 h-2 rounded-full bg-danger-solid" />}
              </div>
              <p className="text-3xl font-bold text-ink mb-1">{count === null ? '—' : count}</p>
              <p className="text-[13px] text-ink-secondary">{c.label}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
