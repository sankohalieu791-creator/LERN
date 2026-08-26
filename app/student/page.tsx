'use client'

import RoleGate from '@/components/v2/RoleGate'
import DashboardShell from '@/components/v2/DashboardShell'
import { useAuth } from '@/context/AuthContext'

function StudentHome() {
  const { user } = useAuth()
  return (
    <DashboardShell>
      <h1 className="text-2xl font-bold text-ink mb-1">Hi, {user?.full_name?.split(' ')[0]}.</h1>
      <p className="text-[#6B6558] mb-10">This is your student home — Feed, My Work, and Profile land here next.</p>
      <div className="grid grid-cols-3 gap-5">
        {['Feed', 'My Work', 'Profile'].map(label => (
          <div key={label} className="bg-white border border-[#E2DDD1] rounded-2xl p-6 h-40 flex items-center justify-center">
            <span className="text-[#A39C8A] font-semibold">{label} — coming next</span>
          </div>
        ))}
      </div>
    </DashboardShell>
  )
}

export default function StudentPage() {
  return (
    <RoleGate allow="student">
      <StudentHome />
    </RoleGate>
  )
}
