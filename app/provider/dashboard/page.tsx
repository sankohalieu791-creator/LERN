'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import JoinCodesPanel from '@/components/v2/JoinCodesPanel'
import ReviewQueuePanel from '@/components/v2/ReviewQueuePanel'
import { BookOpen, ClipboardCheck, CheckCircle2 } from 'lucide-react'

type Tab = 'overview' | 'review' | 'codes'

export default function ProviderDashboardPage() {
  const { user } = useAuth()
  const [org, setOrg] = useState<any>(null)
  const [stats, setStats] = useState({ courses: 0, pending: 0, verified: 0 })
  const [tab, setTab] = useState<Tab>('review')

  useEffect(() => {
    if (!user?.organisation_id) return
    supabase.from('organisations').select('*').eq('id', user.organisation_id).single().then(({ data }) => setOrg(data))

    supabase.from('work_items').select('id', { count: 'exact', head: true })
      .eq('organisation_id', user.organisation_id).eq('type', 'course')
      .then(({ count }) => setStats(s => ({ ...s, courses: count || 0 })))

    supabase.from('submissions').select('id, status, work_items!inner(organisation_id)')
      .eq('work_items.organisation_id', user.organisation_id)
      .then(({ data }) => {
        const rows = data || []
        setStats(s => ({
          ...s,
          pending: rows.filter((r: any) => r.status === 'submitted').length,
          verified: rows.filter((r: any) => r.status === 'verified').length,
        }))
      })
  }, [user?.organisation_id])

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-1">{org?.name || 'Dashboard'}</h1>
      <p className="text-[#6B6558] mb-6">Reviewing and verifying learner work happens here.</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={BookOpen} label="Courses" value={stats.courses} />
        <StatCard icon={ClipboardCheck} label="Awaiting review" value={stats.pending} accent={stats.pending > 0} />
        <StatCard icon={CheckCircle2} label="Verified" value={stats.verified} />
      </div>

      <div className="flex gap-1 mb-5 border-b border-[#EDE9E1]">
        {([['review', 'Review'], ['codes', 'Join codes']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-[14px] font-semibold border-b-2 -mb-px transition ${
              tab === key ? 'text-ink border-brand' : 'text-[#8A8373] border-transparent hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6">
        {tab === 'review' && <ReviewQueuePanel />}
        {tab === 'codes' && <JoinCodesPanel />}
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
