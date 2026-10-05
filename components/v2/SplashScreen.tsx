'use client'

import { useEffect, useState } from 'react'

// The launch splash every real app has -- TikTok/Instagram-style: full
// black screen, wordmark reveals, holds a beat, then fades away to
// reveal the app underneath. Rendered as part of the root layout (a
// server component), so this markup is in the very first HTML the
// browser paints -- no flash of the app underneath before it shows,
// and no flash of unstyled content before it. Only appears on an
// actual fresh document load (cold launch / hard refresh), never on
// in-app client-side navigation, because the root layout that mounts
// this doesn't remount between route changes in the App Router.
//
// Was a single opacity+scale fade on the whole wordmark at once --
// reads as a flash/flicker, not a considered piece of brand motion.
// Real product splash screens (Teams, Slack, Linear) reveal their
// mark deliberately -- piece by piece, then an accent settles in --
// never all at once. This traces the actual logo paths (same source
// as Logo.tsx, not a re-drawn approximation) so each letter can be
// staggered in on its own, then draws an underline beneath once
// they've landed, before the whole thing holds and fades.
//
// Colour is hardcoded black-with-white-wordmark regardless of the
// viewer's light/dark preference, same as TikTok/Instagram do -- the
// splash is brand identity, not themed UI.
// L, E, R-body, N, in that order -- R's accent (drawn separately below,
// in brand orange) lands on the same beat as the R body beside it.
const LETTER_DELAYS_MS = [0, 90, 180, 270]
const R_ACCENT_DELAY_MS = 180

export default function SplashScreen() {
  const [stage, setStage] = useState<'enter' | 'visible' | 'exit' | 'gone'>('enter')

  useEffect(() => {
    try { sessionStorage.setItem('lern-splash-seen', '1') } catch {}
    const raf = requestAnimationFrame(() => setStage('visible'))
    const holdTimer = setTimeout(() => setStage('exit'), 1500)
    const goneTimer = setTimeout(() => setStage('gone'), 1900)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(holdTimer)
      clearTimeout(goneTimer)
    }
  }, [])

  if (stage === 'gone') return null

  const lettersIn = stage === 'visible' || stage === 'exit'

  return (
    <div
      aria-hidden
      data-splash
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#0f0f0f] transition-opacity duration-[400ms] ease-out ${
        stage === 'exit' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 460 180" width={44 * (460 / 180)} height={44} aria-label="LERN" role="img">
          {[
            'M82.82,137.15 L3.88,136.96 L3.49,40.59 L4.08,40.00 L19.36,40.00 L19.94,40.59 L19.94,120.89 L82.82,121.09 L82.82,137.15 Z',
            'M193.68,137.15 L110.83,136.96 L110.83,40.59 L111.42,40.00 L193.29,40.00 L193.88,40.59 L193.68,56.06 L127.08,56.06 L126.50,56.65 L126.50,79.37 L127.08,79.96 L183.10,79.96 L183.69,80.55 L183.10,96.02 L127.08,96.02 L126.50,96.61 L126.50,120.50 L127.08,121.09 L193.68,121.09 L193.68,137.15 Z',
            'M293.97,102.68 L291.23,102.68 L276.53,87.99 L293.58,87.40 L299.06,85.05 L302.00,82.50 L305.13,77.02 L305.92,70.75 L304.35,64.48 L300.63,59.59 L296.71,57.24 L291.62,56.06 L232.07,56.06 L217.77,40.20 L292.79,40.00 L301.80,41.96 L310.03,46.66 L315.71,52.73 L320.02,61.35 L321.19,67.23 L321.19,76.24 L320.41,80.55 L316.88,88.77 L311.20,95.63 L303.76,100.33 L293.97,102.68 Z',
            'M448.31,137.15 L433.82,137.15 L368.40,65.46 L367.42,66.05 L367.42,136.96 L352.53,136.96 L352.73,40.00 L367.22,40.00 L432.25,111.30 L433.23,111.10 L433.23,40.20 L447.92,40.00 L448.51,40.59 L448.31,137.15 Z',
          ].map((d, i) => (
            <path
              key={i}
              fill="#ffffff"
              d={d}
              style={{
                opacity: lettersIn ? 1 : 0,
                animation: lettersIn ? `splashLetterIn 450ms ease-out ${LETTER_DELAYS_MS[i]}ms both` : undefined,
              }}
            />
          ))}
          {/* The R's diagonal accent -- fixed brand orange, same beat as the R body beside it (index 2 in LETTER_DELAYS_MS). */}
          <path
            fill="#F26B21"
            d="M319.43,137.15 L294.36,137.15 L243.63,87.99 L247.35,87.40 L266.94,87.79 L317.86,134.80 L319.63,136.56 L319.43,137.15 Z"
            style={{
              opacity: lettersIn ? 1 : 0,
              animation: lettersIn ? `splashLetterIn 450ms ease-out ${R_ACCENT_DELAY_MS}ms both` : undefined,
            }}
          />
        </svg>
        <div
          className="h-[2px] w-11 mt-2.5 rounded-full"
          style={{
            backgroundColor: '#F26B21',
            transformOrigin: 'left',
            transform: lettersIn ? undefined : 'scaleX(0)',
            animation: lettersIn ? 'splashUnderlineIn 350ms ease-out 620ms both' : undefined,
          }}
        />
      </div>
    </div>
  )
}
