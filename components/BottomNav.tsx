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
    `flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${
      active(p) ? 'text-white' : 'text-[#444]'
    }`

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#0f0f0f] border-t border-[rgba(255,255,255,0.08)]"
      style={{ zIndex: 9999 }}
    >
      <div className="flex items-stretch" style={{ height: '56px' }}>

        <Link href="/feed" className={cls('/feed')}>
          <Home className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-medium">Feed</span>
        </Link>

        <Link href="/courses" className={cls('/courses')}>
          <BookOpen className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-medium">Courses</span>
        </Link>

        <Link href="/discovery" className={cls('/discovery')}>
          <Compass className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-medium">Discover</span>
        </Link>

        <Link href="/profile/me" className={cls('/profile/me')}>
          <User className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>

      </div>
      {/* home-indicator spacer */}
      <div style={{ height: 'env(safe-area-inset-bottom)', background: '#0f0f0f' }} />
    </nav>
  )
}
