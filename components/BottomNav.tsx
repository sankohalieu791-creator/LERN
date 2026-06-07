'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Compass, User } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  if (
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    /^\/feed\/.+/.test(pathname) ||
    pathname.startsWith('/messages')
  ) return null

  const active = (p: string) => pathname === p || pathname.startsWith(p + '/')

  const cls = (p: string) =>
    `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
      active(p) ? 'text-white' : 'text-[#444]'
    }`

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'var(--bg-app)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', height: '56px' }}>

        <Link href="/feed" className={cls('/feed')}>
          <Home style={{ width: 22, height: 22 }} />
          <span style={{ fontSize: 10, fontWeight: 500 }}>Feed</span>
        </Link>

        <Link href="/courses" className={cls('/courses')}>
          <BookOpen style={{ width: 22, height: 22 }} />
          <span style={{ fontSize: 10, fontWeight: 500 }}>Courses</span>
        </Link>

        <Link href="/discovery" className={cls('/discovery')}>
          <Compass style={{ width: 22, height: 22 }} />
          <span style={{ fontSize: 10, fontWeight: 500 }}>Discover</span>
        </Link>

        <Link href="/profile/me" className={cls('/profile/me')}>
          <User style={{ width: 22, height: 22 }} />
          <span style={{ fontSize: 10, fontWeight: 500 }}>Profile</span>
        </Link>

      </div>
      {/* Fills the iPhone home-indicator area — matches theme background */}
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)', background: 'var(--bg-app)' }} />
    </nav>
  )
}
