'use client'

import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { routeForRole } from '@/lib/roleRouting'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    router.replace(user ? routeForRole(user.role) : '/auth/start')
  }, [user, loading, router])

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center">
      <span className="w-6 h-6 border-2 border-[#E2DDD1] border-t-brand rounded-full animate-spin" />
      {/* This page redirects instantly for a real visitor, but it's
          also the literal homepage URL Google's OAuth verification
          checks for a visible privacy-policy link (and any crawler
          that doesn't run the redirect) -- so a real, always-present
          link belongs in the initial HTML here, not buried behind the
          client-side redirect. */}
      <div className="fixed bottom-0 inset-x-0 py-4 flex items-center justify-center gap-4 text-[12px] text-ink-tertiary">
        <a href="/legal/privacy" className="hover:text-ink transition">Privacy Policy</a>
        <span aria-hidden>·</span>
        <a href="/legal/terms" className="hover:text-ink transition">Terms of Service</a>
      </div>
    </div>
  )
}
