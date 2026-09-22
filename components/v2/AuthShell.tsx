'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Logo from '@/components/v2/Logo'

// Shared layout for every auth/onboarding screen: desktop/laptop-first
// (generous centered column, not a mobile card), paper/ink/orange theme.
export default function AuthShell({
  step, totalSteps, title, subtitle, children, wide = false, onBack, bare = false, headerExtra,
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
  // The role-picker landing screen in the reference isn't a form inside
  // a card -- the title floats directly on the background art, and
  // each choice is its own separate glass tile. Every other screen
  // here is a real form and keeps the single glass card. headerExtra
  // is that same reference's top-right "Already have an account?" —
  // content-specific, so the page passes it rather than this shell
  // hardcoding one link.
  bare?: boolean
  headerExtra?: React.ReactNode
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
    // min-h-[100dvh], not min-h-screen (100vh) -- 100vh is a fixed
    // number baked in from whatever the viewport was on load, so on
    // phone it doesn't shrink/grow as the browser's own address bar
    // collapses or reappears while scrolling. dvh recalculates against
    // whatever's actually visible right now instead.
    <div
      className="min-h-[100dvh] flex flex-col relative overflow-hidden bg-[#FBF3E9]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* The reference moodboard's actual background art -- a warm
          peach-to-cream sky, a large soft golden ring arcing across
          the upper-right, and a glossy horizon line with a faint
          skyline reflection -- not a plain gradient. xMidYMid slice
          crops to fill any viewport (portrait phone or wide desktop)
          without stretching, the same way object-fit: cover would for
          a raster image. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1600 1000"
        aria-hidden
      >
        <defs>
          <linearGradient id="auth-sky" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#FBE4CE" />
            <stop offset="45%" stopColor="#F6D9BE" />
            <stop offset="100%" stopColor="#FBF3E9" />
          </linearGradient>
          <linearGradient id="auth-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFDCB0" />
            <stop offset="55%" stopColor="#F0A868" />
            <stop offset="100%" stopColor="#B9713A" />
          </linearGradient>
          <linearGradient id="auth-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EFCFA9" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#FBF3E9" stopOpacity="0" />
          </linearGradient>
          <filter id="auth-soft-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="auth-skyline-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <rect width="1600" height="1000" fill="url(#auth-sky)" />

        {/* The big arcing ring -- the single most recognisable shape in
            the reference. A wide-stroked circle, rotated, blurred at
            the edges so it reads as soft atmospheric light rather than
            a hard graphic. */}
        <circle
          cx="1280" cy="60" r="430"
          fill="none" stroke="url(#auth-ring)" strokeWidth="90"
          opacity="0.55" transform="rotate(28 1280 60)"
          filter="url(#auth-soft-blur)"
        />
        <circle
          cx="1280" cy="60" r="430"
          fill="none" stroke="url(#auth-ring)" strokeWidth="90"
          opacity="0.4" transform="rotate(28 1280 60)"
        />

        {/* Glossy reflective floor + a faint blurred skyline silhouette
            sitting on the horizon, same as the reference's bottom edge. */}
        <rect x="0" y="760" width="1600" height="240" fill="url(#auth-floor)" />
        <g opacity="0.14" fill="#8A6440" filter="url(#auth-skyline-blur)">
          <rect x="60" y="700" width="26" height="70" />
          <rect x="100" y="670" width="34" height="100" />
          <rect x="150" y="710" width="22" height="60" />
          <rect x="190" y="655" width="40" height="115" />
          <rect x="250" y="690" width="28" height="80" />
          <rect x="1180" y="700" width="30" height="70" />
          <rect x="1230" y="660" width="36" height="110" />
          <rect x="1290" y="695" width="24" height="75" />
          <rect x="1340" y="675" width="30" height="95" />
          <rect x="1400" y="715" width="20" height="55" />
        </g>
        <line x1="0" y1="770" x2="1600" y2="770" stroke="#E8C7A0" strokeWidth="1.5" opacity="0.5" />
      </svg>

      <header className="flex-shrink-0 px-10 py-7 flex items-center gap-4 relative z-10">
        <button
          onClick={() => (onBack ? onBack() : router.back())}
          aria-label="Back"
          className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-full hover:bg-black/5 text-ink transition flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Logo size="lg" />
        {headerExtra && <div className="ml-auto">{headerExtra}</div>}
      </header>

      {bare ? (
        <main className="flex-1 flex flex-col items-center px-6 pb-20 pt-4 relative z-10">
          <div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-md'} transition-all duration-500 ease-out ${cardIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
            <h1 className="text-3xl sm:text-4xl font-bold text-ink mb-3 leading-tight text-center">{title}</h1>
            {subtitle && <p className="text-[#6B6558] text-[15px] leading-relaxed mb-10 text-center max-w-xl mx-auto">{subtitle}</p>}
            {!subtitle && <div className="mb-10" />}
            {children}
          </div>
        </main>
      ) : (
        <main className="flex-1 flex items-start justify-center px-6 pb-20 relative z-10">
          {/* The reference's card is glass, not a flat white fill -- the
              sky and ring behind it stay faintly visible through the
              blur, which is the actual "texture" rather than a pattern
              drawn on top of an opaque panel. */}
          <div
            className={`relative w-full ${wide ? 'max-w-3xl' : 'max-w-md'} mt-6 bg-white/65 backdrop-blur-2xl border border-white/60 rounded-[28px] shadow-[0_8px_40px_rgba(120,72,32,0.14)] px-8 py-10 sm:px-12 overflow-hidden transition-all duration-500 ease-out ${
              cardIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
          >
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
      )}

      {/* Bottom-left, per direct request -- so it's reachable from
          every sign-up/login screen without hunting for it. */}
      <footer className="flex-shrink-0 px-6 pb-6 flex items-center gap-4 relative z-10">
        <Link href="/legal/privacy" className="text-[12.5px] font-medium text-[#8A8373] hover:text-ink transition">Privacy</Link>
        <Link href="/legal/terms" className="text-[12.5px] font-medium text-[#8A8373] hover:text-ink transition">Terms</Link>
      </footer>
    </div>
  )
}
