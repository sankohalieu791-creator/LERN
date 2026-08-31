import type { Viewport } from 'next'
import RoleGate from '@/components/v2/RoleGate'
import StudentLayoutClient from '@/components/v2/StudentLayoutClient'

// A real per-segment override, not a runtime meta-tag hack -- the root
// layout's viewport.themeColor is the light paper colour, and Next.js
// re-asserts that on every navigation (App Router segments each carry
// their own metadata/viewport, resolved fresh per route). A JS
// useEffect trying to override it after the fact gets stomped again
// on the very next navigation -- that's exactly the "flashes light
// then goes dark" behaviour. This file being a real server component
// (not 'use client') is what makes a segment-level viewport export
// possible at all; the interactive bits (Plus/composer state) live in
// StudentLayoutClient instead.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f0f0f',
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow="student">
      <StudentLayoutClient>{children}</StudentLayoutClient>
    </RoleGate>
  )
}
