'use client'

import { useState } from 'react'
import RoleGate from '@/components/v2/RoleGate'
import DashboardShell from '@/components/v2/DashboardShell'
import MyWorkPanel from '@/components/v2/MyWorkPanel'
import { useAuth } from '@/context/AuthContext'

type Tab = 'work' | 'feed' | 'profile'

function StudentHome() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('work')

  return (
    <DashboardShell>
      <h1 className="text-2xl font-bold text-ink mb-1">Hi, {user?.full_name?.split(' ')[0]}.</h1>
      <p className="text-[#6B6558] mb-8">Submit work, track feedback, and see what's been verified.</p>

      <div className="flex gap-1 mb-6 border-b border-[#EDE9E1]">
        {([['work', 'My Work'], ['feed', 'Feed'], ['profile', 'Profile']] as [Tab, string][]).map(([key, label]) => (
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

      {tab === 'work' && (
        <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6">
          <MyWorkPanel />
        </div>
      )}
      {tab !== 'work' && (
        <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6 h-40 flex items-center justify-center">
          <span className="text-[#A39C8A] font-semibold capitalize">{tab} — coming next</span>
        </div>
      )}
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
