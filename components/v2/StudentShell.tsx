'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import NotificationsBell from '@/components/v2/NotificationsBell'
import { Home, ClipboardList, Plus, Compass, User as UserIcon, Search } from 'lucide-react'

// Hardcoded dark for now, on purpose — not a theme decision, just
// matching the real reference exactly while that's the only thing
// being built. Light/dark as an actual toggle is real, separate,
// later work, not something to half-wire in here today.
//
// Sizes here are pulled directly from the actual deleted v1
// components/BottomNav.tsx (git show a07a8c2~1), not eyeballed off a
// screenshot: 60px bar, 24px icons, 10px labels, a 46px plus button
// raised -mt-4 above the row. Guessed pixel bumps kept overshooting in
// both directions — this is ground truth, not a guess.
//
// Feed, My Work and Plus are reachable now — Discover/Profile stay
// visible (this is the real, final 5-button structure) but disabled,
// rather than linking to pages that don't match spec yet. Each one
// goes live as it's rebuilt, one at a time.
export default function StudentShell({ children, onPlus }: { children: React.ReactNode; onPlus?: () => void }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  // The real v1 Feed page has its own header (LERN + search + bell);
  // Courses/Workshops (app/courses/page.tsx) has none at all -- its
  // tab bar sits right under the safe area. Same split here.
  const showHeader = isActive('/student/feed')

  return (
    <div data-theme="dark" className="min-h-screen bg-[#0f0f0f] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {showHeader && (
        <header className="flex-shrink-0 bg-[#0f0f0f] border-b border-white/10 sticky top-0 z-20">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-white font-bold text-xl tracking-tight">LERN</span>
            <div className="flex items-center gap-1">
              <button aria-label="Search" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-[#888] transition">
                <Search className="w-5 h-5" />
              </button>
              <NotificationsBell />
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}>{children}</main>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-[#0f0f0f] border-t border-white/10 z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center h-[60px]">
          <NavItem href="/student/feed" icon={Home} label="Feed" active={isActive('/student/feed')} />
          <NavItem href="/student/work" icon={ClipboardList} label="My Work" active={isActive('/student/work')} />
          <PlusButton onClick={onPlus} />
          <DisabledNavItem icon={Compass} label="Discover" />
          <DisabledNavItem icon={UserIcon} label="Profile" />
        </div>
      </nav>
    </div>
  )
}

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link href={href} className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full ${active ? 'text-white' : 'text-[#444]'}`}>
      <Icon className="w-6 h-6" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  )
}

// Plain "+", no box behind it, raised slightly above the row -- a
// quick press twists it into a cross (matches the old app exactly).
function PlusButton({ onClick }: { onClick?: () => void }) {
  return (
    <div className="flex-shrink-0 flex items-center justify-center w-[72px]">
      <button onClick={onClick} aria-label="New post" className="flex items-center justify-center w-[46px] h-[46px] -mt-4 text-white">
        <Plus className="w-7 h-7 transition-transform duration-200 active:rotate-45" />
      </button>
    </div>
  )
}

function DisabledNavItem({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div aria-disabled className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-[#333] cursor-not-allowed">
      <Icon className="w-6 h-6" />
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  )
}
