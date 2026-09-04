import type { Viewport } from 'next'
import { cookies } from 'next/headers'
import RoleGate from '@/components/v2/RoleGate'
import StudentLayoutClient from '@/components/v2/StudentLayoutClient'

// A real per-segment override, not a runtime meta-tag hack -- the root
// layout's viewport.themeColor is the light paper colour, and Next.js
// re-asserts that on every navigation (App Router segments each carry
// their own metadata/viewport, resolved fresh per route). A JS
// useEffect trying to override it after the fact gets stomped again
// on the very next navigation -- that's exactly the "flashes light
// then goes dark" behaviour this was built to avoid.
//
// It was still wrong though -- pinned to dark ('#0f0f0f') regardless
// of the session's actual theme, from back when the student app was
// dark-only. Now that light mode is real, a light-preference session
// got a black browser-chrome tint (Android's address bar, iOS's
// status-bar area) sitting on top of an otherwise light screen -- "a
// black thing showing up" that lived in the OS chrome, not any one
// page component, which is why it kept surviving component-level
// fixes. generateViewport (an async function, not a static object)
// lets this read the lern-theme cookie StudentShell keeps in sync
// with the resolved theme and choose the matching colour server-side,
// still with no client-side meta-tag override to get stomped.
export async function generateViewport(): Promise<Viewport> {
  const theme = cookies().get('lern-theme')?.value
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
    themeColor: theme === 'light' ? '#fafafa' : '#0f0f0f',
  }
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow="student">
      <StudentLayoutClient>{children}</StudentLayoutClient>
    </RoleGate>
  )
}
