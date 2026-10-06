'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Logo from '@/components/v2/Logo'

// Shared layout for every auth/onboarding screen: desktop/laptop-first
// (generous centered column, not a mobile card), paper/ink/orange theme.
export default function AuthShell({
  step, totalSteps, title, subtitle, children, wide = false, onBack, hideBack = false,
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
  // The login page sets this -- "log out shows Welcome back, log in"
  // only actually holds if there's no way OFF that page except the
  // explicit "New to LERN? Sign up" link. A back button (any
  // destination -- '/', browser history, anything) is one more way
  // back into a signed-out state that isn't that deliberate choice.
  hideBack?: boolean
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

  // The real cause of "a dark thing showing at the bottom" -- more
  // direct than the sizing fix below. body's background (globals.css)
  // resolves off html[data-body-theme], and StudentShell/OrgShell both
  // set that explicitly the moment they mount. AuthShell never did --
  // so on a phone whose OS is in dark mode, body fell back to its own
  // prefers-color-scheme default (dark, #131110) despite this page
  // always being the light peachy theme, regardless of OS setting. Any
  // gap at all, even a one-pixel one, was always going to show that
  // wrong colour through. Same attribute, same mechanism the other
  // shells already use -- this page just never set it.
  useEffect(() => {
    document.documentElement.setAttribute('data-body-theme', 'light')
  }, [])


  // min-h-[100dvh] below is a floor, not a lock -- content taller than
  // one screen is meant to push it taller (that's the whole point of
  // min, not a fixed height, for a long signup wizard). The actual bug
  // report: a real black band showing beneath a SHORT page (the plain
  // login screen) in an ordinary Safari tab, above Safari's own
  // toolbar -- body's raw dark background (see app/layout.tsx's own
  // comment on why bg-paper isn't set globally) showing through a gap
  // where this shell's own painted background fell short of the truly
  // visible area. dvh is meant to track the live viewport continuously,
  // but isn't reliably doing that here in practice. visualViewport.height
  // is the one number that always reflects what's REALLY visible right
  // now -- syncing an explicit min-height from it directly closes that
  // gap without touching the "grow for tall content" behaviour at all.
  useEffect(() => {
    const vv = window.visualViewport
    const el = document.getElementById('auth-shell-root')
    if (!vv || !el) return
    const sync = () => {
      const live = vv.height + vv.offsetTop
      el.style.minHeight = `${Math.max(live, document.documentElement.clientHeight)}px`
    }
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    sync()
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      el.style.minHeight = ''
    }
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
    // background with the actual reference image itself, not a
    // hand-drawn approximation of it.
    <div
      id="auth-shell-root"
      className="min-h-[100dvh] flex flex-col relative overflow-hidden bg-[#E7D8D8]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* The picture sits on a full-screen layer, not on this box, so it
          runs right to the top and bottom edges (under the status bar and
          the bottom bar in a home-screen app) instead of stopping at the
          safe-area padding. */}
      <div
        aria-hidden
        className="pointer-events-none"
        style={{
          position: 'fixed', inset: 0, zIndex: -1,
          backgroundImage: 'url(/auth-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <header className="flex-shrink-0 px-10 py-7 flex items-center gap-4 relative z-10">
        {!hideBack && (
          <button
            onClick={() => (onBack ? onBack() : router.back())}
            aria-label="Back"
            className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-full hover:bg-black/5 text-ink transition flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
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
