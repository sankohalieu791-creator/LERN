'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { routeForRole } from '@/lib/roleRouting'

// Deliberately not RoleGate -- RoleGate sends a signed-out visitor to
// /auth/login, the customer-facing sign-in page. This tool is meant to
// be reachable ONLY by LERN admin accounts and nowhere near the
// customer product, so its own unauthenticated fallback is /ops/login,
// never the customer page. A signed-in customer role landing here
// (typed the URL, an old bookmark) gets bounced to their own real
// home, not shown anything about what /ops contains.
export default function OpsGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === '/ops/login'

  useEffect(() => {
    if (loading || isLoginPage) return
    if (!user) { router.replace('/ops/login'); return }
    if (user.role !== 'ops_admin') { router.replace(routeForRole(user.role)); return }
  }, [user, loading, isLoginPage, router])

  if (isLoginPage) return <>{children}</>

  if (loading || !user || user.role !== 'ops_admin') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-[#E2DDD1] border-t-brand rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
