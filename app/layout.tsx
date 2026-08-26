import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

// v2 rebuild: desktop/laptop-first, light theme (paper/ink/orange) —
// the old mobile app-shell chrome (bottom nav, PWA gates, onboarding
// tour, dark-mode toggle) belonged to the v1 TikTok-style product and
// doesn't apply here. Removed rather than adapted, per the "start
// fresh on app structure" direction.
export const metadata: Metadata = {
  title: 'LERN',
  description: 'Verified work, safely.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFFDF9',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-paper text-ink">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
