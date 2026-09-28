'use client'

import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { routeForRole } from '@/lib/roleRouting'
import { hasAccountOnThisDevice } from '@/lib/deviceAccount'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    // A logged-out visit here used to always mean "/auth/start" (the
    // sign-up role chooser) -- correct for a genuinely new visitor, but
    // wrong for someone who already has an account and just signed
    // out, since a PWA/home-screen icon always opens at "/". This is
    // exactly "log out, and it sends you back to sign up instead of
    // welcoming you back to log in". hasAccountOnThisDevice persists
    // across sign-out on purpose, so a returning device goes to login.
    router.replace(user ? routeForRole(user.role) : (hasAccountOnThisDevice() ? '/auth/login' : '/auth/start'))
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
