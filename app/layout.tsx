import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { LanguageProvider } from '@/context/LanguageContext'
import ConditionalNavbar from '@/components/ConditionalNavbar'
import BottomNav from '@/components/BottomNav'
import ThemeProvider from '@/components/ThemeProvider'
import ClientShell from '@/components/ClientShell'
import PushNotificationSetup from '@/components/PushNotificationSetup'
import OnboardingTour from '@/components/OnboardingTour'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const metadata: Metadata = {
  title: 'LERN',
  description: 'Live Social Learning Platform',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LERN',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f0f0f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <LanguageProvider>
        <AuthProvider>
          <ThemeProvider />
          <PushNotificationSetup />
          <ConditionalNavbar />
          <ClientShell>
            {children}
          </ClientShell>
          <BottomNav />
          <OnboardingTour />
        </AuthProvider>
        </LanguageProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
