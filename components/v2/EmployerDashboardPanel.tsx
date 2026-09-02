'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getEmployerDashboardStats } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Complete Build Spec v1.0, Part 3 -- "This month" header, three
// metric tiles, a "Hires by partner" bar list. Plus a real activity
// trend (last 6 months, actual application counts) so the dashboard
// shows whether hiring activity is up or down, not just a flat number.
export default function EmployerDashboardPanel() {
  const { user } = useAuth()
  const [stats, setStats] = useState<{
    hired: number; inPipeline: number; youngPeopleReached: number
    hiresByPartner: { name: string; count: number }[]
    monthlyActivity: { key: string; label: string; count: number }[]
    trend: 'up' | 'down' | 'flat'
  } | null>(null)

  useEffect(() => {
    if (!user) return
    getEmployerDashboardStats(user.id).then(({ data }) => setStats(data))
  }, [user?.id])

  const maxCount = Math.max(1, ...(stats?.hiresByPartner || []).map(p => p.count))
  const maxMonthly = Math.max(1, ...(stats?.monthlyActivity || []).map(m => m.count))

  return (
    <div>
      <p className="text-[16px] font-medium text-ink mb-4">This month</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <MetricTile label="Hired" value={stats?.hired ?? 0} />
        <MetricTile label="In pipeline" value={stats?.inPipeline ?? 0} />
        <MetricTile label="Young people reached" value={stats?.youngPeopleReached ?? 0} />
      </div>

      <div className="bg-surface border border-edge rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[14px] font-medium text-ink">Recent activity</p>
          {stats && (
            <span className={`flex items-center gap-1 text-[12px] font-semibold ${
              stats.trend === 'up' ? 'text-success-text' : stats.trend === 'down' ? 'text-danger-text' : 'text-ink-tertiary'
            }`}>
              {stats.trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : stats.trend === 'down' ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              {stats.trend === 'up' ? 'Increasing' : stats.trend === 'down' ? 'Decreasing' : 'Steady'}
            </span>
          )}
        </div>
        {!stats ? (
          <p className="text-[13px] text-ink-tertiary">Loading…</p>
        ) : (
          <div className="flex items-end gap-3" style={{ height: 100 }}>
            {stats.monthlyActivity.map(m => (
              <div key={m.key} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{ height: `${Math.max(4, (m.count / maxMonthly) * 100)}%`, backgroundColor: m.count > 0 ? '#1D9E75' : '#F7F5F0', minHeight: 4 }}
                />
                <p className="text-[11px] text-ink-tertiary mt-1.5">{m.label}</p>
              </div>
            ))}
          </div>
        )}
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
