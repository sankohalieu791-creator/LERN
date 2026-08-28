import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import ThemeProvider from '@/context/ThemeProvider'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

// v2 rebuild: desktop/laptop-first, paper/ink/orange theme system with a
// real light/dark toggle (see context/ThemeProvider.tsx + the [data-theme]
// tokens in globals.css) — the old mobile app-shell chrome (bottom nav,
// PWA gates, onboarding tour) belonged to the v1 TikTok-style product and
// still doesn't apply here; only dark mode itself came back, done properly.
export const metadata: Metadata = {
  title: 'LERN',
  description: 'Verified work, safely.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFFDF9',
}

// Best-effort pre-hydration theme so a system-dark visitor doesn't see a
// flash of light before React mounts. ThemeProvider corrects this to the
// user's actual stored preference (light/dark/system) once auth loads —
// this inline script only ever guesses from the OS, it's not the source
// of truth.
const themeInitScript = `
try {
  var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light');
} catch (e) {}
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-paper text-ink">
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
