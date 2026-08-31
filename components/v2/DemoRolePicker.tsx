'use client'

import { useState } from 'react'
import { demoSwitchRole } from '@/lib/supabase'
import { ErrorBanner } from '@/components/v2/Field'
import type { Role } from '@/lib/types'
import { GraduationCap, Building2, Briefcase, Landmark } from 'lucide-react'

// Shown once the demo gateway credential (Lern12@gmail.com) is signed in —
// picking a card swaps the session into one of the 4 real seeded test
// accounts via demoSwitchRole(), same one-account-per-role split the app
// itself is built around.
const ROLES: { role: Role; label: string; hint: string; icon: typeof GraduationCap }[] = [
  { role: 'student', label: 'Student', hint: 'Feed, my work, discover', icon: GraduationCap },
  { role: 'institution_staff', label: 'School / college', hint: 'Briefs, review, learners', icon: Landmark },
  { role: 'provider_staff', label: 'Training provider', hint: 'Courses, workshops, review', icon: Building2 },
  { role: 'employer', label: 'Employer', hint: 'Discover talent, opportunities', icon: Briefcase },
]

export default function DemoRolePicker({ onSwitched }: { onSwitched: (role: Role) => void }) {
  const [busy, setBusy] = useState<Role | null>(null)
  const [error, setError] = useState('')

  const pick = async (role: Role) => {
    setError('')
    setBusy(role)
    const { error: err } = await demoSwitchRole(role)
    if (err) {
      setBusy(null)
      setError(err.message || 'Could not switch roles.')
      return
    }
    onSwitched(role)
  }

  return (
    <div>
      <ErrorBanner message={error} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ROLES.map(({ role, label, hint, icon: Icon }) => (
          <button
            key={role}
            onClick={() => pick(role)}
            disabled={busy !== null}
            className="text-left flex items-start gap-3 bg-surface border border-edge rounded-2xl px-4 py-4 hover:border-brand transition disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-bg flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-brand" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-ink">{busy === role ? 'Signing in…' : label}</p>
              <p className="text-[12px] text-ink-tertiary mt-0.5">{hint}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
