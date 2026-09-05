'use client'

import { useEffect, useState } from 'react'
import Logo from '@/components/v2/Logo'

// The launch splash every real app has -- TikTok/Instagram-style: full
// black screen, wordmark fades/scales in, holds a beat, then fades away
// to reveal the app underneath. Rendered as part of the root layout
// (a server component), so this markup is in the very first HTML the
// browser paints -- no flash of the app underneath before it shows, and
// no flash of unstyled content before it. Only appears on an actual
// fresh document load (cold launch / hard refresh), never on in-app
// client-side navigation, because the root layout that mounts this
// doesn't remount between route changes in the App Router -- exactly
// matching how a native app's splash only shows on launch, not on
// every screen it navigates to.
//
// Colour is hardcoded black-with-white-logo regardless of the viewer's
// light/dark preference, same as TikTok/Instagram do -- the splash is
// brand identity, not themed UI.
export default function SplashScreen() {
  const [stage, setStage] = useState<'enter' | 'visible' | 'exit' | 'gone'>('enter')

  useEffect(() => {
    const raf = requestAnimationFrame(() => setStage('visible'))
    const holdTimer = setTimeout(() => setStage('exit'), 1300)
    const goneTimer = setTimeout(() => setStage('gone'), 1700)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(holdTimer)
      clearTimeout(goneTimer)
    }
  }, [])

  if (stage === 'gone') return null

  const logoVisible = stage === 'visible' || stage === 'exit'

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#0f0f0f] transition-opacity duration-[400ms] ease-out ${
        stage === 'exit' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div
        className={`text-white transition-all duration-[550ms] ease-out ${
          logoVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
      >
        <Logo size={54} />
      </div>
    </div>
  )
}
