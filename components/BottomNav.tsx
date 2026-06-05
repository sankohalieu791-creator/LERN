'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Compass, User } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()
  if (pathname === '/' || pathname.startsWith('/auth')) return null
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  const navItems = [
    { href: '/feed',       icon: Home,     label: 'Feed'     },
    { href: '/courses',    icon: BookOpen, label: 'Courses'  },
    { href: '/discovery',  icon: Compass,  label: 'Discover' },
    { href: '/profile/me', icon: User,     label: 'Profile'  },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[rgba(255,255,255,0.07)] flex justify-around items-center z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: '64px' }}>
      {navItems.map(({ href, icon: Icon, label }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 px-5 py-2 transition-colors ${
              active ? 'text-white' : 'text-[#555] hover:text-[#888]'
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
