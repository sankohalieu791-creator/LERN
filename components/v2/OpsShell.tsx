'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from '@/lib/supabase'
import { useResolvedTheme } from '@/context/ThemeProvider'
import Logo from '@/components/v2/Logo'
import { LayoutDashboard, Building2, Flag, ShieldAlert, ClipboardList, ScrollText, Settings, LogOut, Menu, X, UserPlus, ShieldCheck, BadgeCheck, School } from 'lucide-react'

const NAV = [
  { href: '/ops', label: 'Overview', icon: LayoutDashboard },
  { href: '/ops/employers', label: 'Employer verification', icon: Building2 },
  { href: '/ops/approved-employers', label: 'Approved employers', icon: BadgeCheck },
  { href: '/ops/organisations', label: 'Institution & provider verification', icon: School },
  { href: '/ops/reports', label: 'Content reports', icon: Flag },
  { href: '/ops/concerns', label: 'Safeguarding concerns', icon: ShieldAlert },
  { href: '/ops/dbs', label: 'DBS & sessions', icon: ClipboardList },
  { href: '/ops/invite', label: 'Invite', icon: UserPlus },
  { href: '/ops/access', label: 'Ops access', icon: ShieldCheck },
  { href: '/ops/audit', label: 'Audit log', icon: ScrollText },
  { href: '/ops/settings', label: 'Settings', icon: Settings },
]

// Build Spec: Internal Ops Tool v1.0 -- one plain admin shell, no
// customer-facing chrome (no OrgShell reuse), so this can never be
// mistaken for a product surface. Every link here is only ever reached
// past OpsGate (allow ops_admin only). data-theme here is the same
// mechanism OrgShell/StudentShell each apply on their own root --
// without it this shell would always render the light :root tokens
// regardless of the account's theme_preference (see ThemeProvider's
// own comment on why that's not automatic).
export default function OpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const theme = useResolvedTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    router.replace('/ops/login')
  }

  const navLinks = (onNavigate?: () => void) => NAV.map(item => {
    const active = pathname === item.href
    const Icon = item.icon
    return (
      <Link
        key={item.href} href={item.href} onClick={onNavigate}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition ${active ? 'bg-accent-bg text-brand' : 'text-ink-secondary hover:bg-surface-muted'}`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" /> {item.label}
      </Link>
    )
  })

  return (
    <div
      data-theme={theme} className="h-[100dvh] overflow-hidden bg-paper flex"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* h-[100dvh], not h-screen (100vh) -- 100vh on mobile Safari can sit
          taller than what's actually visible while the address bar shows,
          which is exactly "everything pushed upwards, can't reach the top
          bar" (the real fix, not just the padding below): dvh recalculates
          against whatever's actually visible. paddingTop/Bottom here for
          the status bar/notch and home indicator -- this shell never had
          it (OrgShell/AuthShell already do), so the mobile header sat
          underneath the status bar with its menu button unreachable.
          box-sizing:border-box (global reset) means this padding eats into
          the existing h-[100dvh] box rather than adding to it, so it can't
          push the shell taller than the real viewport. */}
      {/* h-screen + overflow-hidden here, not min-h-screen -- a min-height
          lets this whole row grow taller than the viewport to match a
          long page (a big table, say), which drags the sidebar's own
          height along with it and pushes "Sign out" (and on a short
          screen, half the nav) below the fold with no way to reach it.
          Pinning this row to the viewport and letting only <main> scroll
          internally is what actually keeps the sidebar fully on-screen. */}
      {/* Laptop: the sidebar stays exactly as it always did. Phone: it
          disappears entirely (was a fixed 240px column that used to eat
          most of a phone screen, leaving the actual content squeezed into
          a sliver) in favour of a top bar + slide-out drawer, same pattern
          OrgShell already uses for the customer-facing app. */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 border-r border-edge-subtle flex-col py-5 px-3 overflow-y-auto">
        <div className="px-2 mb-6 text-ink"><Logo size="sm" /></div>
        <nav className="flex-1 space-y-1">{navLinks()}</nav>
        <button onClick={handleSignOut} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold text-ink-tertiary hover:text-danger-text hover:bg-surface-muted transition flex-shrink-0">
          <LogOut className="w-4 h-4 flex-shrink-0" /> Sign out
        </button>
      </aside>

      <div className="flex-1 min-w-0 h-full flex flex-col">
        <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-edge-subtle flex-shrink-0">
          <button
            onClick={() => setDrawerOpen(true)} aria-label="Open menu"
            className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-secondary transition flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-ink"><Logo size="md" /></span>
          <span className="w-9" />
        </header>
        {/* tabIndex so a keyboard-only user (no mouse) can Tab straight
            into this scrollable region and use arrow keys/Page Down/Space
            to move through it -- without this, focus has nowhere to land
            inside it and those keys have nothing to act on. */}
        <main tabIndex={0} className="flex-1 min-h-0 px-4 py-5 lg:px-8 lg:py-7 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>

      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div
            className="relative w-[82%] max-w-[300px] h-full bg-surface flex flex-col overflow-y-auto"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
              <span className="text-brand"><Logo size="md" /></span>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-secondary transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="border-t border-edge-subtle flex-shrink-0" />
            <nav className="flex-1 px-3 py-2 space-y-0.5">{navLinks(() => setDrawerOpen(false))}</nav>
            <div className="border-t border-edge-subtle flex-shrink-0 p-3">
              <button onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold text-ink-tertiary hover:text-danger-text hover:bg-surface-muted transition">
                <LogOut className="w-4 h-4 flex-shrink-0" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
