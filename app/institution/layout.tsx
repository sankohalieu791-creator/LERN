import type { Viewport } from 'next'
import { cookies } from 'next/headers'
import InstitutionLayoutClient from '@/components/v2/InstitutionLayoutClient'

// Same fix as app/student/layout.tsx, for org accounts -- see
// OrgShell's own lern-theme cookie-sync effect for the full story.
// This can't be a 'use client' file (needs hooks like useAuth), which
// is exactly why the browser-chrome colour was never theme-aware here
// before: generateViewport only works in a server component.
export async function generateViewport(): Promise<Viewport> {
  const theme = cookies().get('lern-theme')?.value
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
    themeColor: theme === 'dark' ? '#131110' : '#FFFDF9',
    // Was resizes-content -- per-segment generateViewport() REPLACES
    // the root layout's viewport rather than merging with it, so this
    // was silently undoing the root layout's own interactiveWidget fix
    // (its standalone-PWA keyboard bug comment) on every /institution/*
    // route. overlays-content matches root.
    interactiveWidget: 'overlays-content',
  }
}

export default function InstitutionLayout({ children }: { children: React.ReactNode }) {
  return <InstitutionLayoutClient>{children}</InstitutionLayoutClient>
}
