'use client'

import { usePathname } from 'next/navigation'

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = pathname === '/' || pathname.startsWith('/auth')
  const isFeed = pathname.startsWith('/feed')
  const hideNav = isAuth || isFeed

  return (
    <main
      style={
        hideNav
          ? undefined
          : { paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }
      }
    >
      {children}
    </main>
  )
}
