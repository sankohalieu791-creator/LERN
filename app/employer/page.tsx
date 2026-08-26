'use client'

import RoleGate from '@/components/v2/RoleGate'
import DashboardShell from '@/components/v2/DashboardShell'
import { useAuth } from '@/context/AuthContext'

function EmployerHome() {
  const { user } = useAuth()
  return (
    <DashboardShell>
      <h1 className="text-2xl font-bold text-ink mb-1">Hi, {user?.full_name?.split(' ')[0]}.</h1>
      <p className="text-[#6B6558] mb-10">Browse verified profiles and post opportunities — coming next.</p>
      <div className="grid grid-cols-2 gap-5">
        {['Verified profiles', 'Your opportunities'].map(label => (
          <div key={label} className="bg-white border border-[#E2DDD1] rounded-2xl p-6 h-32 flex items-center justify-center">
            <span className="text-[#A39C8A] font-semibold">{label} — coming next</span>
          </div>
        ))}
      </div>
    </DashboardShell>
  )
}

export default function EmployerPage() {
  return (
    <RoleGate allow="employer">
      <EmployerHome />
    </RoleGate>
  )
}
