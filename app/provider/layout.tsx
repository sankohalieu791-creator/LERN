import type { Viewport } from 'next'
import { cookies } from 'next/headers'
import ProviderLayoutClient from '@/components/v2/ProviderLayoutClient'

// Same fix as app/student/layout.tsx and app/institution/layout.tsx --
// see OrgShell's own lern-theme cookie-sync effect for the full story.
export async function generateViewport(): Promise<Viewport> {
  const theme = cookies().get('lern-theme')?.value
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
    themeColor: theme === 'dark' ? '#0c0c0c' : '#FFFDF9',
    // Was resizes-content -- per-segment generateViewport() REPLACES
    // the root layout's viewport rather than merging with it, so this
    // was silently undoing the root layout's own interactiveWidget fix
    // (its standalone-PWA keyboard bug comment) on every /provider/*
    // route. overlays-content matches root.
    interactiveWidget: 'overlays-content',
  }
}

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return <ProviderLayoutClient>{children}</ProviderLayoutClient>
}
