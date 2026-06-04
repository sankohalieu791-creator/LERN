import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import ConditionalNavbar from '@/components/ConditionalNavbar'
import BottomNav from '@/components/BottomNav'
import PlusButton from '@/components/PlusButton'
import ThemeProvider from '@/components/ThemeProvider'
import ClientShell from '@/components/ClientShell'

export const metadata: Metadata = {
  title: 'LERN - Live Social Learning',
  description: 'Learn modern skills from instructors. Build real projects. Get verified skills.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
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
