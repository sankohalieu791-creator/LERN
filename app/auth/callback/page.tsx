'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, getUserProfile } from '@/lib/supabase'
import { routeForRole } from '@/lib/roleRouting'

// Lands here right after Google hands control back to us. The
// Supabase client auto-parses the redirect and sets a live session on
// load (detectSessionInUrl) -- that can land a beat after this effect
// first runs, hence the short poll rather than a single check.
//
// Google never tells us WHICH signup page someone clicked "Continue
// with Google" from, so that intent rides in this URL's own query
// string instead (?intent=student/institution/provider), set by
// whichever page built the redirect. A returning user (already
// consented) skips all of that and goes straight to their real home,
// regardless of intent -- that only matters for a brand-new sign-in.
function CallbackInner() {
  const router = useRouter()
  const params = useSearchParams()
  const intent = params.get('intent')

  useEffect(() => {
    (async () => {
      let user = (await supabase.auth.getUser()).data.user
      for (let i = 0; i < 15 && !user; i++) {
        await new Promise(r => setTimeout(r, 250))
        user = (await supabase.auth.getUser()).data.user
      }
      if (!user) { router.replace('/auth/login'); return }

      const { data: profile } = await getUserProfile(user.id)
      if (profile?.consented_at) {
        router.replace(routeForRole(profile.role))
        return
      }
      if (intent === 'institution' || intent === 'provider') {
        router.replace(`/auth/signup/organisation?type=${intent}`)
      } else if (intent === 'student') {
        router.replace('/auth/signup/student')
      } else if (intent === 'employer') {
        router.replace('/auth/signup/employer')
      } else {
        // Plain "Continue with Google" from the login page, with no
        // account behind it yet -- send them to pick which kind of
        // account this is, same as any other new visitor. The session
        // is already live, so whichever page they land on next just
        // continues from here rather than signing up from scratch.
        router.replace('/auth/start')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <span className="w-6 h-6 border-2 border-[#E2DDD1] border-t-brand rounded-full animate-spin" />
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  )
}
