'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/supabase'
import type { Role } from '@/lib/types'
import { routeForRole } from '@/lib/roleRouting'
import { MailCheck } from 'lucide-react'

// Frontend half of "a student can never reach an organisation view by
// changing a setting or a URL" — the real enforcement is RLS (a student
// session can't read org-scoped data regardless of what page it's on),
// this just stops the wrong shell from rendering at all if someone
// lands on the wrong role's route directly.
export default function RoleGate({ allow, children }: { allow: Role; children: React.ReactNode }) {
  const { user, authUser, loading } = useAuth()
  const router = useRouter()
  // Backend already blocks the actions that matter regardless of this
  // (see current_user_email_confirmed() in RLS) — this is the UX half so
  // an unconfirmed account sees why they're stuck instead of a silent
  // permission error the first time they try to do something.
  const unconfirmed = !!authUser && !authUser.email_confirmed_at

  // A student or employer can end up with a valid session but an
  // unfinished signup -- never accepted the safeguarding step. A missing
  // organisation_id is NOT incomplete on its own for a student:
  // explore-without-code is a real, legitimate, permanent state until
  // they enter a code, not something to bounce back to the wizard for.
  const incomplete = (allow === 'student' || allow === 'employer') && !!user && !user.consented_at
  const wizardRoute = allow === 'employer' ? '/auth/signup/employer' : '/auth/signup/student'

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/auth/login'); return }
    if (user.role !== allow) { router.replace(routeForRole(user.role)); return }
    if (incomplete) router.replace(wizardRoute)
  }, [user, loading, allow, incomplete, wizardRoute, router])

  if (loading || !user || user.role !== allow || incomplete) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-[#E2DDD1] border-t-brand rounded-full animate-spin" />
      </div>
    )
  }

  if (unconfirmed) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-[#FCEEE4] flex items-center justify-center mx-auto mb-4">
            <MailCheck className="w-5 h-5 text-brand" />
          </div>
          <p className="font-bold text-ink text-[17px] mb-2">Confirm your email</p>
          <p className="text-[14px] text-[#6B6558] mb-6">
            We sent a confirmation link to <span className="font-semibold text-ink">{authUser?.email}</span>.
            Click it, then come back here — nothing on LERN works for an unverified account.
          </p>
          <button onClick={() => signOut()} className="text-[13px] font-semibold text-brand hover:underline">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
