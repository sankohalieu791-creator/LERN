'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { getMyOpportunities, getMyInterest, getDiscoverWork } from '@/lib/supabase'
import { Megaphone, Users, BadgeCheck, ArrowRight, Briefcase, FileText } from 'lucide-react'

export default function EmployerDashboardPanel() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ opportunities: 0, pipeline: 0 })
  const [recent, setRecent] = useState<any[]>([])

  useEffect(() => {
    if (!user) return
    getMyOpportunities(user.id).then(({ data }) => setStats(s => ({ ...s, opportunities: (data || []).length })))
    getMyInterest(user.id).then(({ data }) => setStats(s => ({ ...s, pipeline: (data || []).filter(i => i.status !== 'declined').length })))
    getDiscoverWork().then(({ data }) => setRecent((data || []).slice(0, 5)))
  }, [user])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">Hi, {user?.full_name?.split(' ')[0]}.</h1>
        <p className="text-ink-tertiary text-[14px]">Here's what's happening with your candidates and opportunities.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Megaphone} label="Active opportunities" value={stats.opportunities} href="/employer/opportunities" />
        <StatCard icon={Users} label="Candidates in pipeline" value={stats.pipeline} href="/employer/job-tracker" />
        <ComingCard icon={FileText} label="Briefs out" href="/employer/briefs" />
        <ComingCard icon={Briefcase} label="Job Tracker" href="/employer/job-tracker" />
      </div>

      <div className="bg-surface border border-edge rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-ink text-[15px]">Recent verified work matching your interests</p>
          <Link href="/employer/discover" className="text-[13px] font-semibold text-brand hover:underline flex items-center gap-1">
            Browse all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-ink-tertiary text-[14px]">Nothing verified yet — check back soon.</p>
        ) : (
          <div className="space-y-2">
            {recent.map(v => (
              <div key={v.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-edge-subtle last:border-0">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-ink truncate">{v.submissions?.work_items?.title}</p>
                  <p className="text-[12px] text-ink-tertiary truncate">{v.submissions?.student?.full_name}</p>
                </div>
                <span className="flex items-center gap-1 text-[12px] font-semibold text-success-text flex-shrink-0">
                  <BadgeCheck className="w-3.5 h-3.5" /> Verified
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, href }: { icon: any; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="bg-surface border border-edge rounded-2xl p-5 hover:border-brand transition">
      <Icon className="w-4 h-4 text-brand mb-3" />
      <p className="text-2xl font-bold text-ink mb-0.5">{value}</p>
      <p className="text-[12px] text-ink-tertiary">{label}</p>
    </Link>
  )
}

function ComingCard({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
  return (
    <Link href={href} className="bg-surface-subtle border border-edge-subtle rounded-2xl p-5 hover:border-edge transition">
      <Icon className="w-4 h-4 text-ink-tertiary mb-3" />
      <p className="text-[13px] font-semibold text-ink-tertiary mb-0.5">Coming soon</p>
      <p className="text-[12px] text-ink-quaternary">{label}</p>
    </Link>
  )
}
