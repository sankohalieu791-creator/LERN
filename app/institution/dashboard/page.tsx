'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import JoinCodesPanel from '@/components/v2/JoinCodesPanel'
import { Users, ClipboardCheck, CheckCircle2, FileText, AlertTriangle, Flag, Briefcase, Clock } from 'lucide-react'

const OVERDUE_HOURS = 48

export default function InstitutionDashboardPage() {
  const { user } = useAuth()
  const [org, setOrg] = useState<any>(null)
  const [stats, setStats] = useState({ students: 0, briefs: 0, pending: 0, verified: 0 })
  const [overdue, setOverdue] = useState<any[]>([])
  const [flagged, setFlagged] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])

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
      .select('id, decision, created_at, users(full_name), submissions!inner(work_items!inner(title, organisation_id))')
      .eq('submissions.work_items.organisation_id', orgId)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setActivity((data as any[]) || []))
  }, [user?.organisation_id])

  const needsAttention = overdue.length + flagged.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">{org?.name || 'Dashboard'}</h1>
        <p className="text-[#6B6558]">
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

      {needsAttention > 0 && (
        <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6">
          <p className="font-bold text-ink text-[15px] mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#B3401E]" /> Needs attention ({needsAttention})
          </p>
          <div className="space-y-2">
            {overdue.map(r => (
              <div key={r.id} className="flex items-center justify-between text-[13px] px-3.5 py-2.5 bg-[#FFF7ED] rounded-lg">
                <span className="text-ink">{r.users?.full_name} — {r.work_items?.title}</span>
                <span className="flex items-center gap-1.5 text-[#B3651E] font-semibold"><Clock className="w-3.5 h-3.5" /> Overdue &gt;{OVERDUE_HOURS}h</span>
              </div>
            ))}
            {flagged.map(r => (
              <div key={r.id} className="flex items-center justify-between text-[13px] px-3.5 py-2.5 bg-[#FDEEEA] rounded-lg">
                <span className="text-ink">{r.users?.full_name} — {r.work_items?.title}</span>
                <span className="flex items-center gap-1.5 text-[#B3401E] font-semibold"><Flag className="w-3.5 h-3.5" /> Flagged</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6">
          <p className="font-bold text-ink text-[15px] mb-4">Recent activity</p>
          {activity.length === 0 ? (
            <p className="text-[13px] text-[#8A8373]">No reviews yet.</p>
          ) : (
            <div className="space-y-2.5">
              {activity.map(a => (
                <div key={a.id} className="text-[13px] text-[#6B6558]">
                  <span className="font-semibold text-ink capitalize">{a.decision}</span>
                  {' — '}{a.submissions?.work_items?.title}
                  <span className="block text-[12px] text-[#8A8373]">
                    {a.users?.full_name} · {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#F5F1E8] flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-4 h-4 text-[#8A8373]" />
          </div>
          <div>
            <p className="font-semibold text-ink text-[14px]">Job-application tracking &amp; funder/Ofsted analytics</p>
            <p className="text-[13px] text-[#8A8373]">Coming soon — through LERN only, once live.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6">
        <JoinCodesPanel />
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-white border border-[#E2DDD1] rounded-2xl p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${accent ? 'bg-[#FCEEE4]' : 'bg-[#F5F1E8]'}`}>
        <Icon className={`w-4 h-4 ${accent ? 'text-brand' : 'text-[#8A8373]'}`} />
      </div>
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="text-[13px] text-[#8A8373]">{label}</p>
    </div>
  )
}
