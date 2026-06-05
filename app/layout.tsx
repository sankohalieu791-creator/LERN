import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import ConditionalNavbar from '@/components/ConditionalNavbar'
import BottomNav from '@/components/BottomNav'
import PlusButton from '@/components/PlusButton'
import ThemeProvider from '@/components/ThemeProvider'
import ClientShell from '@/components/ClientShell'

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
        <link rel="apple-touch-icon" href="/images/IMG_0400.PNG" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider />
          <ConditionalNavbar />
          <ClientShell>
            {children}
          </ClientShell>
          <BottomNav />
          <PlusButton />
        </AuthProvider>
      </body>
    </html>
  )
}
