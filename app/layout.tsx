import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import ThemeProvider from '@/context/ThemeProvider'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import ServiceWorkerRegistration from '@/components/v2/ServiceWorkerRegistration'
import SplashScreen from '@/components/v2/SplashScreen'

// v2 rebuild: desktop/laptop-first, paper/ink/orange. Dark mode exists
// today only inside the institution/provider shell (see
// components/v2/OrgShell.tsx + context/ThemeProvider.tsx) — deliberately
// scoped there, not global, since auth/student/employer pages haven't
// been converted to the token system yet and a global dark attribute
// would put light-mode text on their still-hardcoded-white backgrounds.
// The old mobile app-shell chrome (bottom nav, PWA gates, onboarding
// tour) belonged to the v1 TikTok-style product and still doesn't apply
// here.
export const metadata: Metadata = {
  title: 'LERN',
  description: 'Verified work, safely.',
  manifest: '/manifest.json',
  // 'default' is a WHITE status bar on an installed iOS PWA -- that's
  // the actual, static cause of the white strip at the top over
  // My Work/Discover (where clock/wifi/battery sit), not something a
  // runtime theme-color change can override. black-translucent makes
  // the status bar transparent instead, so whatever's actually
  // painted behind it (dark on the student shell, light elsewhere)
  // shows through correctly on every page, not just one hardcoded colour.
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'LERN' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FFFDF9',
  // Was 'resizes-content' -- correct in an ordinary Safari tab, but a
  // well-documented WebKit bug specifically in standalone/home-screen
  // PWA mode: resizing the LAYOUT viewport down when the keyboard opens
  // is not reliably reversed when it closes, leaving window.innerHeight/
  // 100dvh permanently reporting the shrunken size with nothing able to
  // force it back short of backgrounding and refocusing the app. Every
  // fixed-positioned bottom element sized against that (the student
  // bottom nav, the org FAB, any dvh-capped dialog) then genuinely,
  // permanently sits too high -- not a timing bug in when a class gets
  // toggled (three prior attempts here all assumed that), the viewport
  // itself was actually still the wrong size. 'overlays-content' keeps
  // the layout viewport fixed regardless of the keyboard -- the keyboard
  // simply floats on top of whatever's underneath instead, which mobile
  // browsers already scroll a focused field clear of on their own. The
  // JS-driven hide (StudentShell's/OrgShell's own keyboard-open class)
  // still exists on top of this for the nav/FAB specifically, but no
  // longer depends on the layout viewport ever resizing at all.
  interactiveWidget: 'overlays-content',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Runs before first paint: if this tab already played the launch
            splash this session, mark the page so the splash is hidden
            before anything renders. iOS unloads a backgrounded web app and
            reloads it on return -- that's a fresh document load, which
            replayed the full splash every time. Splash stays once per
            session, not once per reload. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(sessionStorage.getItem('lern-splash-seen'))document.documentElement.setAttribute('data-splash-seen','')}catch(e){}",
          }}
        />
      </head>
      {/* No bg-paper here on purpose -- it was the actual root cause of
          the white status-bar strip and the white flash during scroll,
          on EVERY page, this whole time. bg-paper is a Tailwind CLASS
          (specificity 0,1,0), which beats globals.css's plain `body {
          background-color: #0f0f0f }` element rule (specificity 0,0,1)
          outright, regardless of which file loads first or in what
          order -- so body's real, rendered background was always the
          light paper colour, dark-mode fallback or not. Every real
          shell (StudentShell, OrgShell, AuthShell, ...) already paints
          its own full-bleed background over this, so body's own colour
          only ever shows through a gap -- that's exactly the bug this
          was. text-ink is harmless to keep; it's not a background. */}
      <body className="text-ink">
        <SplashScreen />
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
        <ServiceWorkerRegistration />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
