'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import NotificationsBell from '@/components/v2/NotificationsBell'
import { Home, ClipboardList, Plus, Compass, User as UserIcon, Search } from 'lucide-react'

// Hardcoded dark for now, on purpose — not a theme decision, just
// matching the one reference screenshot exactly while that's the only
// thing being built. Light/dark as an actual toggle is real, separate,
// later work, not something to half-wire in here today.
//
// Feed and My Work are reachable now — Plus/Discover/Profile stay
// visible (this is the real, final 5-button structure) but disabled,
// rather than linking to pages that don't match spec yet. Each one
// goes live as it's rebuilt, one at a time.
export default function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div data-theme="dark" className="min-h-screen bg-[#0f0f0f] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="flex items-center justify-between h-14 px-4 flex-shrink-0 bg-[#0f0f0f] border-b border-white/10 sticky top-0 z-20">
        <span className="text-white font-black text-xl tracking-tight">LERN</span>
        <div className="flex items-center gap-1">
          <button aria-label="Search" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition">
            <Search className="w-[19px] h-[19px]" />
          </button>
          <NotificationsBell />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}>{children}</main>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-[#0f0f0f] border-t border-white/10 flex items-center justify-around h-16 z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <NavItem href="/student/feed" icon={Home} label="Feed" active={isActive('/student/feed')} />
        <NavItem href="/student/work" icon={ClipboardList} label="My Work" active={isActive('/student/work')} />
        <DisabledNavItem icon={Plus} label="" isPlus />
        <DisabledNavItem icon={Compass} label="Discover" />
        <DisabledNavItem icon={UserIcon} label="Profile" />
      </nav>
    </div>
  )
}

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link href={href} className={`flex flex-col items-center gap-0.5 ${active ? 'text-white' : 'text-[#666]'}`}>
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  )
}

function DisabledNavItem({ icon: Icon, label, isPlus }: { icon: any; label: string; isPlus?: boolean }) {
  if (isPlus) {
    return (
      <div aria-disabled className="w-12 h-12 rounded-2xl bg-white/10 text-[#555] flex items-center justify-center -mt-1 cursor-not-allowed">
        <Icon className="w-6 h-6" />
      </div>
    )
  }
  return (
    <div aria-disabled className="flex flex-col items-center gap-0.5 text-[#3a3a3a] cursor-not-allowed">
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-semibold">{label}</span>
    </div>
  )
}
