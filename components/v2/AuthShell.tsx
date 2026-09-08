'use client'

import Link from 'next/link'
import Logo from '@/components/v2/Logo'

// Shared layout for every auth/onboarding screen: desktop/laptop-first
// (generous centered column, not a mobile card), paper/ink/orange theme.
export default function AuthShell({
  step, totalSteps, title, subtitle, children, wide = false,
}: {
  step?: number
  totalSteps?: number
  title: string
  subtitle?: string
  children: React.ReactNode
  wide?: boolean
}) {
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
    <div
      className="min-h-screen flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', background: 'linear-gradient(180deg, var(--accent-bg-soft) 0%, var(--accent-bg) 30%, var(--paper) 75%)' }}
    >
      <header className="flex-shrink-0 px-10 py-7">
        <Logo size="lg" />
      </header>

      <main className="flex-1 flex items-start justify-center px-6 pb-20">
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
      <footer className="flex-shrink-0 px-6 pb-6 flex items-center gap-4">
        <Link href="/legal/privacy" className="text-[12.5px] font-medium text-[#8A8373] hover:text-ink transition">Privacy</Link>
        <Link href="/legal/terms" className="text-[12.5px] font-medium text-[#8A8373] hover:text-ink transition">Terms</Link>
      </footer>
    </div>
  )
}
