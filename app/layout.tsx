import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import ThemeProvider from '@/context/ThemeProvider'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import ServiceWorkerRegistration from '@/components/v2/ServiceWorkerRegistration'

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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-paper text-ink">
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
