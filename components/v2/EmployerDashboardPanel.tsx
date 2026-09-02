'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getEmployerDashboardStats } from '@/lib/supabase'

// Complete Build Spec v1.0, Part 3 -- "This month" header, three
// metric tiles, a "Hires by partner" bar list. Real numbers straight
// from applications, not placeholders -- "The dashboard must show real
// hiring numbers... keep the figures accurate and partner-attributed."
export default function EmployerDashboardPanel() {
  const { user } = useAuth()
  const [stats, setStats] = useState<{ hired: number; inPipeline: number; youngPeopleReached: number; hiresByPartner: { name: string; count: number }[] } | null>(null)

  useEffect(() => {
    if (!user) return
    getEmployerDashboardStats(user.id).then(({ data }) => setStats(data))
  }, [user?.id])

  const maxCount = Math.max(1, ...(stats?.hiresByPartner || []).map(p => p.count))

  return (
    <div>
      <p className="text-[16px] font-medium text-ink mb-4">This month</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <MetricTile label="Hired" value={stats?.hired ?? 0} />
        <MetricTile label="In pipeline" value={stats?.inPipeline ?? 0} />
        <MetricTile label="Young people reached" value={stats?.youngPeopleReached ?? 0} />
      </div>

      <div className="bg-surface border border-edge rounded-2xl p-5">
        <p className="text-[14px] font-medium text-ink mb-4">Hires by partner</p>
        {!stats || stats.hiresByPartner.length === 0 ? (
          <p className="text-[13px] text-ink-tertiary">No hires yet — this fills in as candidates move to Hired.</p>
        ) : (
          <div className="space-y-3">
            {stats.hiresByPartner.map(p => (
              <div key={p.name} className="flex items-center gap-3">
                <p className="text-[13px] text-ink truncate" style={{ width: 120, flexShrink: 0 }}>{p.name}</p>
                <div className="flex-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(p.count / maxCount) * 100}%`, backgroundColor: '#1D9E75' }} />
                </div>
                <p className="text-[13px] font-medium text-ink flex-shrink-0">{p.count}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg p-[13px]" style={{ backgroundColor: '#F7F5F0' }}>
      <p className="text-[12px]" style={{ color: '#5A5A5A' }}>{label}</p>
      <p className="text-[24px] font-medium mt-1" style={{ color: '#1A1A1A' }}>{value}</p>
    </div>
  )
}
