'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase, recordConsent, getUserProfile } from '@/lib/supabase'
import AuthShell from '@/components/v2/AuthShell'

// Where the guest's magic link actually lands. This used to depend on
// AuthContext's own user/loading state -- but that context does its
// own separate getSession() check on mount, which can race against
// the Supabase client's own (asynchronous) parsing of the session out
// of this very URL. Lose that race and user never becomes non-null
// here: the page sits on its spinner forever with nothing to explain
// why, which is exactly what "the link doesn't work" looked like.
// This now polls the session directly instead -- same proven pattern
// as the Google sign-in callback -- so it doesn't depend on
// AuthContext's own timing at all, and surfaces a real message if the
// link genuinely is dead (expired, already used, or pre-opened by an
// email app's link scanner) instead of spinning forever.
export default function GuestConfirmPage() {
  const { refreshUser } = useAuth()
  const router = useRouter()
  const [error, setError] = useState('')
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true
    ;(async () => {
      let authUser = (await supabase.auth.getUser()).data.user
      for (let i = 0; i < 15 && !authUser; i++) {
        await new Promise(r => setTimeout(r, 250))
        authUser = (await supabase.auth.getUser()).data.user
      }
      if (!authUser) {
        setError("That link didn't work — it may have expired, already been used, or been opened somewhere the click could be intercepted (some email apps pre-open links to scan them before you click). Ask whoever invited you for a fresh one.")
        return
      }
      const { data: profile } = await getUserProfile(authUser.id)
      if (profile && !profile.consented_at) await recordConsent(authUser.id)
      await refreshUser()
      router.replace('/employer')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthShell title={error ? "Couldn't sign you in" : 'Signing you in…'}>
      {error ? (
        <p className="text-[14px] text-danger-text leading-relaxed">{error}</p>
      ) : (
        <div className="flex justify-center py-10">
          <span className="w-6 h-6 border-2 border-[#E2DDD1] border-t-brand rounded-full animate-spin" />
        </div>
      )}
    </AuthShell>
  )
}
