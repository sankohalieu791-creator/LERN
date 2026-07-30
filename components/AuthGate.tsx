'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

// Safeguarding: nothing in the app is reachable without a logged-in session.
// `/` already redirects itself; every other route not under /auth requires
// a user. This is the client-side half of the fix — the real guarantee is
// the matching RLS tightening (see supabase/migrations), which makes the
// database itself refuse to return data to a logged-out request regardless
// of how it's made.
export default function AuthGate() {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (loading || user) return
    if (pathname === '/' || pathname.startsWith('/auth')) return
    router.replace('/auth/login')
  }, [user, loading, pathname, router])

  return null
}
