'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import type { Role } from '@/lib/types'
import { routeForRole } from '@/lib/roleRouting'

// Frontend half of "a student can never reach an organisation view by
// changing a setting or a URL" — the real enforcement is RLS (a student
// session can't read org-scoped data regardless of what page it's on),
// this just stops the wrong shell from rendering at all if someone
// lands on the wrong role's route directly.
export default function RoleGate({ allow, children }: { allow: Role; children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  // A student can end up with a valid session but an unfinished signup --
  // e.g. they created an account but never entered a join code, or never
  // accepted the safeguarding step. Without this check they'd land on a
  // dashboard with no organisation to load anything against (My Work spins
  // forever) instead of being sent back to finish the wizard.
  const incomplete = allow === 'student' && !!user && (!user.organisation_id || !user.consented_at)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/auth/login'); return }
    if (user.role !== allow) { router.replace(routeForRole(user.role)); return }
    if (incomplete) router.replace('/auth/signup/student')
  }, [user, loading, allow, incomplete, router])

  if (loading || !user || user.role !== allow || incomplete) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-[#E2DDD1] border-t-brand rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
