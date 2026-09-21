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
  const [cardIn, setCardIn] = useState(false)

  // See globals.css's own comment on body.auth-scroll -- every other
  // shell keeps the app-wide hidden scrollbar (native-app feel), but a
  // long signup screen needs a real, visible one so keyboard-only
  // navigation (no mouse) has something to actually see moving.
  useEffect(() => {
    document.body.classList.add('auth-scroll')
    const t = setTimeout(() => setCardIn(true), 60)
    return () => { document.body.classList.remove('auth-scroll'); clearTimeout(t) }
  }, [])

  return (
    // paddingTop: env(safe-area-inset-top) -- missing entirely before,
    // so on a standalone PWA the LERN logo sat right at the true top
    // edge, under the status bar ("the LERN is a bit up"). Every other
    // shell in the app has had this same fix today; this one was
    // still missing it.
    //
    // Background matches the reference moodboard exactly: a soft warm
    // glow from the upper-right corner (radial, not the old plain top-
    // to-bottom fade) settling into the paper tone, with the form
    // living inside its own raised card rather than directly on the
    // gradient. min-h-[100dvh], not min-h-screen (100vh) -- 100vh is a
    // fixed number baked in from whatever the viewport was on load, so
    // on phone it doesn't shrink/grow as the browser's own address bar
    // collapses or reappears while scrolling. That's exactly "the
    // footer doesn't stick down, it stays up where the bigger address-
    // bar-visible viewport put it" -- dvh recalculates against
    // whatever's actually visible right now instead.
    <div
      className="min-h-[100dvh] flex flex-col relative overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)', background: 'radial-gradient(circle at 88% -10%, var(--accent-bg-soft) 0%, var(--accent-bg) 32%, var(--paper) 68%)' }}
    >
      <header className="flex-shrink-0 px-10 py-7 flex items-center gap-4 relative z-10">
        <button
          onClick={() => (onBack ? onBack() : router.back())}
          aria-label="Back"
          className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-full hover:bg-black/5 text-ink transition flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Logo size="lg" />
      </header>

      <main className="flex-1 flex items-start justify-center px-6 pb-20 relative z-10">
        {/* The raised card from the reference: white, generously
            rounded, a soft shadow lifting it off the gradient, and the
            same barely-there flowing wave pattern behind the content
            (a plain inline SVG, no image request) that gives the
            reference's card its quiet texture instead of a flat fill. */}
        <div
          className={`relative w-full ${wide ? 'max-w-3xl' : 'max-w-md'} mt-6 bg-white rounded-[28px] shadow-[0_8px_40px_rgba(120,72,32,0.14)] px-8 py-10 sm:px-12 overflow-hidden transition-all duration-500 ease-out ${
            cardIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 400 500" aria-hidden>
            <path d="M-20,120 C80,90 140,160 260,110 C340,78 380,130 430,95" fill="none" stroke="#F26B21" strokeOpacity="0.05" strokeWidth="26" />
            <path d="M-30,340 C60,300 160,380 250,330 C330,286 370,340 420,300" fill="none" stroke="#F26B21" strokeOpacity="0.04" strokeWidth="22" />
          </svg>

          <div className="relative">
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
        </div>
      </main>

      {/* Bottom-left, per direct request -- so it's reachable from
          every sign-up/login screen without hunting for it. */}
      <footer className="flex-shrink-0 px-6 pb-6 flex items-center gap-4 relative z-10">
        <Link href="/legal/privacy" className="text-[12.5px] font-medium text-[#8A8373] hover:text-ink transition">Privacy</Link>
        <Link href="/legal/terms" className="text-[12.5px] font-medium text-[#8A8373] hover:text-ink transition">Terms</Link>
      </footer>
    </div>
  )
}
