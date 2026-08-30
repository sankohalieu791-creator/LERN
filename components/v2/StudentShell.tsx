'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/v2/Logo'
import NotificationsBell from '@/components/v2/NotificationsBell'
import { Home, ClipboardList, Plus, Compass, User as UserIcon } from 'lucide-react'

// Phone-first, on purpose — a single centered column that's just as
// usable wide (the nav stays fixed to the bottom either way), not a
// laptop-first shell squeezed down. Bottom nav is the only navigation;
// there's no sidebar to reach for.
export default function StudentShell({ onPlus, children }: { onPlus: () => void; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="flex items-center justify-between h-14 px-4 flex-shrink-0 border-b border-edge-subtle">
        <Logo size="sm" />
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <button
            onClick={() => router.push('/student/settings')}
            aria-label="Settings"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-muted text-ink-secondary transition"
          >
            <UserIcon className="w-[18px] h-[18px]" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-xl w-full mx-auto px-4 py-5 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-edge-subtle flex items-center justify-around h-16 z-30">
        <NavItem href="/student/feed" icon={Home} label="Feed" active={isActive('/student/feed')} />
        <NavItem href="/student/work" icon={ClipboardList} label="My Work" active={isActive('/student/work')} />
        <button
          onClick={onPlus} aria-label="Post"
          className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center -mt-1 shadow-lg shadow-brand/30 active:scale-95 transition"
        >
          <Plus className="w-6 h-6" />
        </button>
        <NavItem href="/student/discover" icon={Compass} label="Discover" active={isActive('/student/discover')} />
        <NavItem href="/student/profile" icon={UserIcon} label="Profile" active={isActive('/student/profile')} />
      </nav>
    </div>
  )
}

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link href={href} className={`flex flex-col items-center gap-0.5 ${active ? 'text-brand' : 'text-ink-tertiary'}`}>
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  )
}
