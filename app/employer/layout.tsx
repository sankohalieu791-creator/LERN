import type { Viewport } from 'next'
import { cookies } from 'next/headers'
import EmployerLayoutClient from '@/components/v2/EmployerLayoutClient'

// Same fix as app/student/layout.tsx and app/institution/layout.tsx --
// see OrgShell's own lern-theme cookie-sync effect for the full story.
// A guest employer's GuestEmployerShell doesn't toggle dark mode, so
// the light value here is the right fallback for that case too.
export async function generateViewport(): Promise<Viewport> {
  const theme = cookies().get('lern-theme')?.value
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
    themeColor: theme === 'dark' ? '#131110' : '#FFFDF9',
  }
}

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return <EmployerLayoutClient>{children}</EmployerLayoutClient>
}
