'use client'

import { useEffect } from 'react'
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

  // See globals.css's own comment on body.auth-scroll -- every other
  // shell keeps the app-wide hidden scrollbar (native-app feel), but a
  // long signup screen needs a real, visible one so keyboard-only
  // navigation (no mouse) has something to actually see moving.
  useEffect(() => {
    document.body.classList.add('auth-scroll')
    return () => document.body.classList.remove('auth-scroll')
  }, [])

  return (
    // paddingTop: env(safe-area-inset-top) -- missing entirely before,
    // so on a standalone PWA the LERN logo sat right at the true top
    // edge, under the status bar ("the LERN is a bit up"). Every other
    // shell in the app has had this same fix today; this one was
    // still missing it.
    //
    // min-h-[100dvh], not min-h-screen (100vh) -- 100vh is a fixed number
    // baked in from whatever the viewport was on load, so on phone it
    // doesn't shrink/grow as the browser's own address bar collapses or
    // reappears while scrolling. That's exactly "the footer doesn't
    // stick down, it stays up where the bigger address-bar-visible
    // viewport put it" -- dvh recalculates against whatever's actually
    // visible right now instead.
    //
    // The layout itself (no wrapping card anywhere, content straight on
    // the background) stays exactly as it was -- this only replaces the
    // flat gradient with the reference's actual background art: a warm
    // sky, a soft arcing ring, and a glossy horizon with a faint
    // skyline. Texture, not structure.
    <div
      className="min-h-[100dvh] flex flex-col relative overflow-hidden bg-[#FBF3E9]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
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
      </header>

      <main className="flex-1 flex items-start justify-center px-6 pb-20 relative z-10">
        <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'} pt-6`}>
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
      <footer className="flex-shrink-0 px-6 pb-6 flex items-center gap-4 relative z-10">
        <Link href="/legal/privacy" className="text-[12.5px] font-medium text-[#8A8373] hover:text-ink transition">Privacy</Link>
        <Link href="/legal/terms" className="text-[12.5px] font-medium text-[#8A8373] hover:text-ink transition">Terms</Link>
      </footer>
    </div>
  )
}
