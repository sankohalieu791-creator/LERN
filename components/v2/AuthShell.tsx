'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Logo from '@/components/v2/Logo'

// Shared layout for every auth/onboarding screen: desktop/laptop-first
// (generous centered column, not a mobile card), paper/ink/orange theme.
export default function AuthShell({
  step, totalSteps, title, subtitle, children, wide = false, onBack,
}: {
  step?: number
  totalSteps?: number
  title: string
  subtitle?: string
  children: React.ReactNode
  wide?: boolean
  // A wizard step passes its own handler (go back one step); anything
  // without one falls back to plain browser back, so this always does
  // something sensible without every call site needing to think about it.
  onBack?: () => void
}) {
  const router = useRouter()
  // Google/Teams-style sign-in never just appears -- the mark and the
  // card each settle in with a short, separate beat rather than the
  // whole page popping in at once instantly, which read as "dead."
  // Two flags, not one: the logo leads by ~80ms so it doesn't look tied
  // to the card, the same slight stagger Google's own sign-in uses.
  const [logoIn, setLogoIn] = useState(false)
  const [cardIn, setCardIn] = useState(false)

  // See globals.css's own comment on body.auth-scroll -- every other
  // shell keeps the app-wide hidden scrollbar (native-app feel), but a
  // long signup screen needs a real, visible one so keyboard-only
  // navigation (no mouse) has something to actually see moving.
  useEffect(() => {
    document.body.classList.add('auth-scroll')
    const t1 = setTimeout(() => setLogoIn(true), 30)
    const t2 = setTimeout(() => setCardIn(true), 110)
    return () => {
      document.body.classList.remove('auth-scroll')
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    // paddingTop: env(safe-area-inset-top) -- missing entirely before,
    // so on a standalone PWA the LERN logo sat right at the true top
    // edge, under the status bar ("the LERN is a bit up"). Every other
    // shell in the app has had this same fix today; this one was
    // still missing it.
    //
    // A flat white page read as cold/unfinished next to everything
    // else in this app that already has real warmth to it -- a soft
    // gradient using the SAME peach/cream tokens the rest of the app's
    // accent surfaces already use, not new colours invented for this
    // one screen. First pass held the colour back until 45% down the
    // page, past where a normal-height form actually sits, so it was
    // never actually visible without scrolling -- "still white."
    // --accent-bg-soft (a deeper peach than --accent-bg) now shows
    // immediately at the top where the logo and form both live, fading
    // to --paper further down. Instagram-adjacent without borrowing
    // anything literal: warm, not saturated, still this app's own
    // paper/ink/orange identity.
    // min-h-[100dvh], not min-h-screen (100vh) -- 100vh is a fixed number
    // baked in from whatever the viewport was on load, so on phone it
    // doesn't shrink/grow as the browser's own address bar collapses or
    // reappears while scrolling. That's exactly "the footer doesn't
    // stick down, it stays up where the bigger address-bar-visible
    // viewport put it" -- dvh recalculates against whatever's actually
    // visible right now instead.
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', background: 'linear-gradient(180deg, var(--accent-bg-soft) 0%, var(--accent-bg) 30%, var(--paper) 75%)' }}
    >
      <header className="flex-shrink-0 px-10 py-7 flex items-center gap-4">
        <button
          onClick={() => (onBack ? onBack() : router.back())}
          aria-label="Back"
          className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-full hover:bg-black/5 text-ink transition flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className={`transition-all duration-500 ease-out ${logoIn ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}>
          <Logo size="lg" />
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 pb-20">
        {/* The Google/Teams shape this was asked to move toward: the
            form lives inside its own raised card floating on the page's
            gradient, not directly on it -- same colours as before,
            just given an actual edge instead of blending straight into
            the background. White, not a theme token -- this shell is
            deliberately light-only (see the file header comment), so a
            theme-variable surface colour would go dark under a system
            dark preference while everything else here stayed light. */}
        <div
          className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'} mt-6 bg-white border border-[#E2DDD1] rounded-[28px] shadow-[0_2px_24px_rgba(26,20,10,0.08)] px-8 py-10 sm:px-12 transition-all duration-500 ease-out ${
            cardIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          {step && totalSteps && (
            <div className="flex items-center gap-1.5 mb-8">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < step ? 'bg-brand' : 'bg-[#EDE9E1]'
                  }`}
                />
              ))}
            </div>
          )}

          <h1 className="text-3xl font-bold text-ink mb-2 leading-tight text-center">{title}</h1>
          {subtitle && <p className="text-[#6B6558] text-[15px] leading-relaxed mb-8 text-center">{subtitle}</p>}
          {!subtitle && <div className="mb-8" />}

          {children}
        </div>
      </main>

      {/* Bottom-left, per direct request -- so it's reachable from
          every sign-up/login screen without hunting for it. */}
      <footer className="flex-shrink-0 px-6 pb-6 flex items-center gap-4">
        <Link href="/legal/privacy" className="text-[12.5px] font-medium text-[#8A8373] hover:text-ink transition">Privacy</Link>
        <Link href="/legal/terms" className="text-[12.5px] font-medium text-[#8A8373] hover:text-ink transition">Terms</Link>
      </footer>
    </div>
  )
}
