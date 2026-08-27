'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import JoinCodesPanel from '@/components/v2/JoinCodesPanel'
import { Users, ClipboardCheck, CheckCircle2 } from 'lucide-react'

export default function InstitutionDashboardPage() {
  const { user } = useAuth()
  const [org, setOrg] = useState<any>(null)
  const [stats, setStats] = useState({ students: 0, pending: 0, verified: 0 })

  useEffect(() => {
    if (!user?.organisation_id) return
    supabase.from('organisations').select('*').eq('id', user.organisation_id).single().then(({ data }) => setOrg(data))

    supabase.from('users').select('id', { count: 'exact', head: true })
      .eq('organisation_id', user.organisation_id).eq('role', 'student')
      .then(({ count }) => setStats(s => ({ ...s, students: count || 0 })))

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">{org?.name || 'Dashboard'}</h1>
        <p className="text-[#6B6558]">
          {org?.safeguarding_lead_id === user?.id
            ? "You're the safeguarding lead — every review is logged and visible to you."
            : 'Overview.'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Users} label="Students" value={stats.students} />
        <StatCard icon={ClipboardCheck} label="Awaiting review" value={stats.pending} accent={stats.pending > 0} />
        <StatCard icon={CheckCircle2} label="Verified" value={stats.verified} />
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
