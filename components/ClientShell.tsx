'use client'

import { usePathname } from 'next/navigation'

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = pathname === '/' || pathname.startsWith('/auth')
  return <main className={isAuth ? '' : 'pb-24'}>{children}</main>
}
