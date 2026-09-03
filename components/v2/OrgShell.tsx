'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useResolvedTheme } from '@/context/ThemeProvider'
import { setSidebarCollapsed, setPresenceStatus, signOut, supabase, getPendingReviewCount, getPendingInterestCount } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, Settings, User as UserIcon, Plus, LogOut, Menu, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Logo from '@/components/v2/Logo'
import NotificationsBell from '@/components/v2/NotificationsBell'

function orgInitials(name?: string | null) {
  if (!name) return 'LN'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

// "/institution" -> "Institution", "/provider" -> "Training provider",
// "/employer" -> "Employer" -- derived from sections[0].href the same
// way the Settings button already derives its own path, rather than
// threading a new prop through every layout.tsx for one label.
function roleLabelFromHref(href: string) {
  if (href.startsWith('/institution')) return 'Institution'
  if (href.startsWith('/provider')) return 'Training provider'
  if (href.startsWith('/employer')) return 'Employer'
  return ''
}

export interface NavItem { key: string; label: string; icon: LucideIcon; href: string }

const PRESENCE_DOT: Record<string, string> = {
  active: 'bg-success-solid',
  busy: 'bg-danger-solid',
  away: 'bg-ink-quaternary',
}

// The shared shell for both organisation roles — collapsible sidebar on
// laptop (state remembered server-side, not just localStorage). Phone
// is a Gmail-style layout now: a hamburger opens a slide-out drawer
// (org identity, the full nav list with live badge counts, Settings
// pinned after a divider) instead of a bottom tab bar, and posting is
// a floating "+" in the bottom-right corner rather than embedded in a
// nav row -- built from a direct reference screenshot, not guessed.
export default function OrgShell({
  sections, phoneItems, children,
}: {
  sections: NavItem[]
  phoneItems: [NavItem, NavItem, NavItem] // feed, role-specific second item, dashboard — kept for the FAB's own destination
  children: React.ReactNode
}) {
  const { user, refreshUser } = useAuth()
  const theme = useResolvedTheme()
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [reviewCount, setReviewCount] = useState(0)
  const [interestCount, setInterestCount] = useState(0)

  useEffect(() => { setCollapsed(!!user?.sidebar_collapsed) }, [user?.sidebar_collapsed])
  useEffect(() => {
    if (!user?.organisation_id) return
    supabase.from('organisations').select('name').eq('id', user.organisation_id).single()
      .then(({ data }) => setOrgName(data?.name ?? null))
  }, [user?.organisation_id])

  // Badge counts are real, not decorative -- only fetched (and only
  // rendered, see NAV_BADGES below) for the sections that actually
  // have a matching count. No fabricated numbers on sections that
  // don't have one (employer's nav has neither key today).
  useEffect(() => {
    if (!user?.organisation_id) return
    if (sections.some(s => s.key === 'review')) getPendingReviewCount(user.organisation_id).then(({ count }) => setReviewCount(count))
    if (sections.some(s => s.key === 'interest')) getPendingInterestCount().then(({ count }) => setInterestCount(count))
  }, [user?.organisation_id])
  const NAV_BADGES: Record<string, number> = { review: reviewCount, interest: interestCount }

  const toggleCollapsed = async () => {
    const next = !collapsed
    setCollapsed(next)
    if (user) await setSidebarCollapsed(user.id, next)
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/auth/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // h-[100dvh] + overflow-hidden (not min-h-screen) — same fix as
  // StudentShell: a flex container that's only min-height means content
  // taller than the viewport grows the whole shell instead of scrolling
  // inside main, and every flex child down the chain needs min-h-0 to
  // actually respect that bound rather than refusing to shrink below
  // its own content's natural height (flexbox's default min-height:auto).
  // dvh not vh -- 100vh is fixed to mobile Safari's LARGEST viewport
  // (toolbar hidden), taller than what's visible while the address bar
  // is still showing, so h-screen looked right on desktop but caused
  // exactly the same "pulls down as you scroll" mismatch on phone.
  return (
    // paddingTop: env(safe-area-inset-top) -- missing entirely before,
    // so on a standalone PWA the whole shell (top bar included) sat
    // right at the true top edge, under the status bar/notch ("the top
    // nav is so high, all the way where my wifi/data is"). Every other
    // full-screen shell in the app already has this; this one never did.
    // Harmless on desktop -- env() resolves to 0 with no notch/status
    // bar to avoid.
    <div data-theme={theme} className="h-[100dvh] overflow-hidden bg-paper flex" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* ── Laptop sidebar ── */}
      <aside className={`hidden lg:flex flex-col border-r border-edge-subtle bg-surface transition-[width] duration-150 flex-shrink-0 ${collapsed ? 'w-[72px]' : 'w-60'}`}>
        <div className={`flex items-center h-16 px-4 flex-shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {/* Plain wordmark, not the chip — matches the student feed's
              top-left header treatment exactly, per explicit request. */}
          {!collapsed && <span className="text-ink font-bold text-xl tracking-tight">LERN</span>}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-secondary transition flex-shrink-0"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {sections.map(s => (
            <Link
              key={s.key} href={s.href}
              title={collapsed ? s.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold transition ${
                isActive(s.href) ? 'bg-accent-bg text-brand' : 'text-ink-secondary hover:bg-surface-muted'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <s.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span className="truncate">{s.label}</span>}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {/* ── Top bar ── phone gets a hamburger (opens the drawer) before
            the wordmark, and no Settings gear -- Settings lives in the
            drawer's own list instead, last item after a divider. */}
        <header className="flex items-center justify-between h-16 px-5 lg:px-8 border-b border-edge-subtle flex-shrink-0">
          <div className="flex items-center gap-1 lg:hidden">
            <button
              onClick={() => setDrawerOpen(true)} aria-label="Open menu"
              className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-secondary transition flex-shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Logo size="sm" />
          </div>
          <div className="hidden lg:block text-[14px] font-semibold text-ink-secondary truncate">{orgName}</div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <button
              aria-label="Settings" onClick={() => router.push(`${sections[0].href.split('/').slice(0, 2).join('/')}/settings`)}
              className="hidden lg:flex w-9 h-9 items-center justify-center rounded-lg hover:bg-surface-muted text-ink-secondary transition"
            >
              <Settings className="w-[18px] h-[18px]" />
            </button>
            <div className="relative">
              <button
                onClick={() => setProfileOpen(v => !v)}
                aria-label="Profile menu"
                className="relative w-9 h-9 flex items-center justify-center rounded-full bg-accent-bg text-brand font-bold text-[13px] ml-1"
              >
                {user?.full_name?.[0]?.toUpperCase() || <UserIcon className="w-4 h-4" />}
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface ${PRESENCE_DOT[user?.presence_status || 'active']}`} />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-11 bg-surface border border-edge rounded-xl shadow-lg py-1.5 w-52 z-20">
                    <div className="px-3.5 py-2 border-b border-edge-subtle">
                      <p className="text-[13px] font-semibold text-ink truncate">{user?.full_name}</p>
                      <p className="text-[12px] text-ink-tertiary truncate">{user?.email}</p>
                    </div>
                    <div className="px-3.5 py-2.5 border-b border-edge-subtle">
                      <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1.5">Status</p>
                      <div className="flex gap-1.5">
                        {(['active', 'busy', 'away'] as const).map(s => (
                          <button
                            key={s}
                            onClick={async () => { if (user) { await setPresenceStatus(user.id, s); await refreshUser() } }}
                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-semibold capitalize transition ${
                              (user?.presence_status || 'active') === s ? 'bg-surface-muted text-ink' : 'text-ink-tertiary hover:bg-surface-muted'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${PRESENCE_DOT[s]}`} /> {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-ink-secondary hover:bg-surface-muted transition">
                      <LogOut className="w-3.5 h-3.5" /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto bg-paper px-5 lg:px-10 py-7 pb-8">
          {children}
        </main>
      </div>

      {/* ── Phone floating "+" -- Gmail-style: bottom-right, elevated
          above content rather than reserving a row for it in a bottom
          bar (there is no bottom bar any more; navigation moved into
          the drawer). Same destination the old Plus button had --
          posting happens on the Feed itself, not in a separate composer
          here. safe-area-inset-bottom so it never sits under a phone's
          own home-indicator/gesture bar. ── */}
      <button
        onClick={() => router.push(phoneItems[0].href)}
        aria-label="New post"
        className="lg:hidden fixed right-5 z-20 w-14 h-14 rounded-full bg-brand text-white shadow-lg flex items-center justify-center active:scale-95 transition"
        style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom))', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* ── Phone nav drawer -- Gmail-style: org identity card, the
          full section list (live badge counts, active item highlighted),
          Settings last after a divider. Replaces the old bottom tab bar
          entirely; direct 1:1 with the reference screenshot. ── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div
            className="relative w-[82%] max-w-[320px] h-full bg-surface flex flex-col overflow-y-auto"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-1 flex-shrink-0">
              <span className="text-brand font-bold text-lg tracking-tight">LERN</span>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-secondary transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0">
              {/* rounded-full, not rounded-2xl -- every other avatar in
                  the app (profile, feed, students roster, review queue)
                  is a circle; a squared badge here was the exact
                  inconsistency flagged before on Profile. */}
              <span className="w-12 h-12 rounded-full bg-accent-bg text-brand font-bold text-[15px] flex items-center justify-center flex-shrink-0">
                {orgInitials(orgName)}
              </span>
              <div className="min-w-0">
                <p className="text-[16px] font-bold text-ink truncate">{orgName || '—'}</p>
                <p className="text-[13px] text-ink-tertiary">{roleLabelFromHref(sections[0]?.href || '')}</p>
              </div>
            </div>
            <div className="border-t border-edge-subtle flex-shrink-0" />

            <nav className="flex-1 px-3 py-2 space-y-0.5">
              {sections.map(s => {
                const active = isActive(s.href)
                const badge = NAV_BADGES[s.key]
                return (
                  <Link
                    key={s.key} href={s.href} onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-[15px] font-semibold transition ${
                      active ? 'bg-accent-bg text-brand' : 'text-ink-secondary'
                    }`}
                  >
                    <s.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{s.label}</span>
                    {!!badge && (
                      <span className="flex-shrink-0 min-w-[22px] text-center text-[11px] font-bold text-white bg-brand rounded-full px-[7px] py-[2px]">
                        {badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>

            <div className="border-t border-edge-subtle flex-shrink-0" />
            <div className="px-3 py-2 flex-shrink-0">
              <button
                onClick={() => { setDrawerOpen(false); router.push(`${sections[0].href.split('/').slice(0, 2).join('/')}/settings`) }}
                className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-[15px] font-semibold text-ink-secondary transition"
              >
                <Settings className="w-5 h-5 flex-shrink-0" /> Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
