'use client'

import { usePathname } from 'next/navigation'

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = pathname === '/' || pathname.startsWith('/auth')
  const isFeed = pathname.startsWith('/feed')
  return <main className={isAuth || isFeed ? '' : 'pb-24'}>{children}</main>
}
