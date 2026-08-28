'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import JoinCodesPanel from '@/components/v2/JoinCodesPanel'
import {
  Users, ClipboardCheck, CheckCircle2, FileText, AlertTriangle, Flag, Clock,
  KeyRound, TrendingUp, TrendingDown, ClipboardList, PlusCircle, Ticket,
} from 'lucide-react'

const OVERDUE_HOURS = 48
const EXPIRING_DAYS = 7
const HEAVY_USE = 20

export default function InstitutionDashboardPage() {
  const { user } = useAuth()
  const [org, setOrg] = useState<any>(null)
  const [stats, setStats] = useState({ students: 0, briefs: 0, pending: 0, verified: 0 })
  const [overdue, setOverdue] = useState<any[]>([])
  const [flagged, setFlagged] = useState<any[]>([])
  const [attentionCodes, setAttentionCodes] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [trend, setTrend] = useState<{ thisWeek: number; lastWeek: number } | null>(null)

  useEffect(() => {
    if (!user?.organisation_id) return
    const orgId = user.organisation_id
    supabase.from('organisations').select('*').eq('id', orgId).single().then(({ data }) => setOrg(data))

    supabase.from('users').select('id', { count: 'exact', head: true })
      .eq('organisation_id', orgId).eq('role', 'student')
      .then(({ count }) => setStats(s => ({ ...s, students: count || 0 })))

    supabase.from('work_items').select('id', { count: 'exact', head: true })
      .eq('organisation_id', orgId).eq('type', 'brief')
      .then(({ count }) => setStats(s => ({ ...s, briefs: count || 0 })))

    supabase.from('submissions')
      .select('id, status, submitted_at, moderation_status, users(full_name), work_items!inner(title, organisation_id)')
      .eq('work_items.organisation_id', orgId)
      .then(({ data }) => {
        const rows = (data as any[]) || []
        const cutoff = Date.now() - OVERDUE_HOURS * 60 * 60 * 1000
        setStats(s => ({
          ...s,
          pending: rows.filter(r => r.status === 'submitted').length,
          verified: rows.filter(r => r.status === 'verified').length,
        }))
        setOverdue(rows.filter(r => r.status === 'submitted' && new Date(r.submitted_at).getTime() < cutoff))
        setFlagged(rows.filter(r => r.moderation_status !== 'clear'))
      })

    supabase.from('reviews')
      .select('id, decision, feedback, created_at, users(full_name), submissions!inner(work_items!inner(title, organisation_id))')
      .eq('submissions.work_items.organisation_id', orgId)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setActivity((data as any[]) || []))

    supabase.from('verifications')
      .select('verified_at, submissions!inner(work_items!inner(organisation_id))')
      .eq('submissions.work_items.organisation_id', orgId)
      .gte('verified_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .then(({ data }) => {
        const rows = (data as any[]) || []
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        setTrend({
          thisWeek: rows.filter(r => new Date(r.verified_at).getTime() >= weekAgo).length,
          lastWeek: rows.filter(r => new Date(r.verified_at).getTime() < weekAgo).length,
        })
      })

    supabase.from('join_codes').select('*').eq('organisation_id', orgId).eq('revoked', false)
      .then(({ data }) => {
        const cutoff = Date.now() + EXPIRING_DAYS * 24 * 60 * 60 * 1000
        setAttentionCodes((data || []).filter((c: any) =>
          (c.expires_at && new Date(c.expires_at).getTime() < cutoff) || c.used_count >= HEAVY_USE
        ))
      })
  }, [user?.organisation_id])

  const needsAttention = overdue.length + flagged.length + attentionCodes.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">{org?.name || 'Dashboard'}</h1>
        <p className="text-ink-secondary">
          {org?.safeguarding_lead_id === user?.id
            ? "You're the safeguarding lead — every review is logged and visible to you."
            : 'Overview.'}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Users} label="Students" value={stats.students} />
        <StatCard icon={FileText} label="Active briefs" value={stats.briefs} />
        <StatCard icon={ClipboardCheck} label="Awaiting review" value={stats.pending} accent={stats.pending > 0} />
        <StatCard icon={CheckCircle2} label="Verified" value={stats.verified} />
      </div>

      <div className="flex gap-3">
        <QuickAction href="/institution/review" icon={ClipboardList} label="Review queue" />
        <QuickAction href="/institution/briefs" icon={PlusCircle} label="Create a brief" />
        <QuickAction href="/institution/dashboard#join-codes" icon={Ticket} label="Generate join code" />
      </div>

      {needsAttention > 0 && (
        <div className="bg-surface border border-edge rounded-2xl p-6">
          <p className="font-bold text-ink text-[15px] mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-danger-text" /> Needs attention ({needsAttention})
          </p>
          <div className="space-y-2">
            {overdue.map(r => (
              <div key={r.id} className="flex items-center justify-between text-[13px] px-3.5 py-2.5 bg-warning-bg-soft rounded-lg">
                <span className="text-ink">{r.users?.full_name} — {r.work_items?.title}</span>
                <span className="flex items-center gap-1.5 text-warning-text font-semibold"><Clock className="w-3.5 h-3.5" /> Overdue &gt;{OVERDUE_HOURS}h</span>
              </div>
            ))}
            {flagged.map(r => (
              <div key={r.id} className="flex items-center justify-between text-[13px] px-3.5 py-2.5 bg-danger-bg rounded-lg">
                <span className="text-ink">{r.users?.full_name} — {r.work_items?.title}</span>
                <span className="flex items-center gap-1.5 text-danger-text font-semibold"><Flag className="w-3.5 h-3.5" /> Flagged</span>
              </div>
            ))}
            {attentionCodes.map(c => (
              <div key={c.id} className="flex items-center justify-between text-[13px] px-3.5 py-2.5 bg-warning-bg-soft rounded-lg">
                <span className="text-ink font-mono">{c.code}</span>
                <span className="flex items-center gap-1.5 text-warning-text font-semibold">
                  <KeyRound className="w-3.5 h-3.5" />
                  {c.used_count >= HEAVY_USE ? `Used ${c.used_count} times` : `Expires ${new Date(c.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface border border-edge rounded-2xl p-6">
          <p className="font-bold text-ink text-[15px] mb-4">Recent activity</p>
          {activity.length === 0 ? (
            <p className="text-[13px] text-ink-tertiary">No reviews yet.</p>
          ) : (
            <div className="space-y-3">
              {activity.map(a => (
                <div key={a.id} className="text-[13px] text-ink-secondary">
                  <span className="font-semibold text-ink capitalize">{a.decision}</span>
                  {' — '}{a.submissions?.work_items?.title}
                  <span className="block text-[12px] text-ink-tertiary">
                    {a.users?.full_name} · {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  {a.feedback && <span className="block text-[12px] text-ink-secondary italic mt-0.5">"{a.feedback}"</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-edge rounded-2xl p-6">
            <p className="font-bold text-ink text-[15px] mb-3">Verified this week</p>
            {trend === null ? (
              <p className="text-[13px] text-ink-tertiary">Loading…</p>
            ) : (
              <div className="flex items-center gap-2.5">
                <p className="text-2xl font-bold text-ink">{trend.thisWeek}</p>
                {trend.thisWeek !== trend.lastWeek && (
                  <span className={`flex items-center gap-1 text-[12px] font-semibold ${trend.thisWeek >= trend.lastWeek ? 'text-success-text' : 'text-danger-text'}`}>
                    {trend.thisWeek >= trend.lastWeek ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    vs {trend.lastWeek} last week
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div id="join-codes" className="bg-surface border border-edge rounded-2xl p-6">
        <JoinCodesPanel />
      </div>
    </div>
  )
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 bg-surface border border-edge rounded-xl px-4 py-2.5 text-[13px] font-semibold text-ink hover:border-brand hover:text-brand transition">
      <Icon className="w-4 h-4" /> {label}
    </Link>
  )
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-surface border border-edge rounded-2xl p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${accent ? 'bg-accent-bg' : 'bg-surface-muted'}`}>
        <Icon className={`w-4 h-4 ${accent ? 'text-brand' : 'text-ink-tertiary'}`} />
      </div>
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="text-[13px] text-ink-tertiary">{label}</p>
    </div>
  )
}
