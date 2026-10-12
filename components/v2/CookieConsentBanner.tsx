'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { setCookieConsent } from '@/lib/supabase'

const STORAGE_KEY = 'lern-cookie-consent'

// The app had a fully-built cookie_consent field + toggle in Settings
// (lib/supabase.ts's setCookieConsent, already used by SettingsPanel)
// but nothing ever actually asked a visitor on first use -- the only
// way to find the toggle was to already be digging through Settings.
// This is that missing first-visit ask, global (mounted in the root
// layout, inside AuthProvider so it can read/write the signed-in
// user's own record) rather than scoped to any one shell.
export default function CookieConsentBanner() {
  const { user, refreshUser } = useAuth()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Signed-in: the DB record (set here or later from Settings) is
    // the one source of truth, so a user who already chose never sees
    // this again regardless of device. Signed-out: localStorage is the
    // only thing available before there's an account to attach it to.
    if (user) {
      if (!user.cookie_consent) {
        const timer = setTimeout(() => setVisible(true), 800)
        return () => clearTimeout(timer)
      }
      return
    }
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const timer = setTimeout(() => setVisible(true), 800)
        return () => clearTimeout(timer)
      }
    } catch {}
  }, [user])

  const decide = async (analytics: boolean) => {
    setVisible(false)
    if (user) {
      await setCookieConsent(user.id, analytics)
      await refreshUser()
    } else {
      try { localStorage.setItem(STORAGE_KEY, analytics ? 'accepted' : 'declined') } catch {}
    }
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-x-0 z-[80] px-4 sm:px-6"
      // A fixed offset clear of every shell's own mobile bottom nav
      // (StudentShell/OrgShell, ~60px + safe-area) rather than trying
      // to match each one's exact height -- sits a little higher than
      // flush-bottom on desktop too, which costs nothing there.
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
    >
      <div className="mx-auto max-w-2xl bg-[#1A1A1A] text-white rounded-2xl shadow-2xl px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-[13.5px] leading-relaxed text-white/85 flex-1">
          We use cookies to understand how people use LERN and to improve the app. We never sell your data.{' '}
          <Link href="/legal/cookies" className="underline hover:text-white">Cookie policy</Link>
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => decide(false)} className="px-4 py-2 rounded-full text-[13px] font-semibold text-white/70 hover:text-white transition">
            Decline
          </button>
          <button onClick={() => decide(true)} className="px-4 py-2 rounded-full text-[13px] font-semibold bg-white text-[#1A1A1A] hover:opacity-90 transition">
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
