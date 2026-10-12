'use client'

import { useEffect, useState } from 'react'
import StudentMyWorkPanel from '@/components/v2/StudentMyWorkPanel'
import SkillWalletPanel from '@/components/v2/SkillWalletPanel'

// Phone layout only, per direct request: "My Work" stays the entry
// point, with two tabs on top switching between My Work and My Skill
// Wallet. Desktop gets Skill Wallet as its own standalone sidebar item
// instead (StudentShell's DESKTOP_NAV) -- this switcher doesn't apply
// there, so desktop just shows My Work directly.
//
// Checked via matchMedia (Tailwind's lg breakpoint, 1024px), not a
// lg:hidden/hidden:lg CSS pair -- rendering both branches and letting
// CSS pick one would still mount StudentMyWorkPanel twice at once
// (each firing its own data fetches), since Tailwind's responsive
// classes don't stop React from mounting the hidden branch.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}

export default function StudentWorkContainer() {
  const [tab, setTab] = useState<'work' | 'wallet'>('work')
  const isDesktop = useIsDesktop()

  if (isDesktop) return <StudentMyWorkPanel />

  return (
    <div>
      <div className="flex items-stretch border-b border-[var(--app-border-subtle)] bg-[var(--app-bg)]">
        <TabButton active={tab === 'work'} label="My Work" onClick={() => setTab('work')} />
        <TabButton active={tab === 'wallet'} label="My Skill Wallet" onClick={() => setTab('wallet')} />
      </div>
      {tab === 'work' ? <StudentMyWorkPanel /> : <SkillWalletPanel />}
    </div>
  )
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-3.5 text-sm font-semibold border-b-2 transition"
      style={active ? { color: 'var(--app-text)', borderColor: '#D4551A' } : { color: '#5A5A5A', borderColor: 'transparent' }}
    >
      {label}
    </button>
  )
}
