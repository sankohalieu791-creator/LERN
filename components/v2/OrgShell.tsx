'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useResolvedTheme } from '@/context/ThemeProvider'
import { setSidebarCollapsed, setPresenceStatus, signOut, supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, Settings, User as UserIcon, Plus, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Logo from '@/components/v2/Logo'
import NotificationsBell from '@/components/v2/NotificationsBell'

export interface NavItem { key: string; label: string; icon: LucideIcon; href: string }

const PRESENCE_DOT: Record<string, string> = {
  active: 'bg-success-solid',
  busy: 'bg-danger-solid',
  away: 'bg-ink-quaternary',
}

// The shared shell for both organisation roles — collapsible sidebar on
// laptop (state remembered server-side, not just localStorage), bottom
// nav with a Plus on phone (Plus only exists on phone — posting to the
// feed happens there, not on laptop, per the layout spec).
export default function OrgShell({
  sections, phoneItems, children,
}: {
  sections: NavItem[]
  phoneItems: [NavItem, NavItem, NavItem] // feed, role-specific second item, dashboard — Plus and Profile are inserted around these
  children: React.ReactNode
}) {
  const { user, refreshUser } = useAuth()
  const theme = useResolvedTheme()
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => { setCollapsed(!!user?.sidebar_collapsed) }, [user?.sidebar_collapsed])
  useEffect(() => {
    if (!user?.organisation_id) return
    supabase.from('organisations').select('name').eq('id', user.organisation_id).single()
      .then(({ data }) => setOrgName(data?.name ?? null))
  }, [user?.organisation_id])

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

  return (
    <div data-theme={theme} className="min-h-screen bg-paper flex">
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

      <div className="flex-1 min-w-0 flex flex-col">
        {/* ── Top bar ── */}
        <header className="flex items-center justify-between h-16 px-5 lg:px-8 border-b border-edge-subtle flex-shrink-0">
          <div className="lg:hidden"><Logo size="sm" /></div>
          <div className="hidden lg:block text-[14px] font-semibold text-ink-secondary truncate">{orgName}</div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <button
              aria-label="Settings" onClick={() => router.push(`${sections[0].href.split('/').slice(0, 2).join('/')}/settings`)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-secondary transition"
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

        <main className="flex-1 overflow-y-auto bg-paper px-5 lg:px-10 py-7 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* ── Phone bottom nav ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-edge-subtle flex items-center justify-around h-16 z-10">
        <PhoneNavItem item={phoneItems[0]} active={isActive(phoneItems[0].href)} />
        <PhoneNavItem item={phoneItems[1]} active={isActive(phoneItems[1].href)} />
        <button
          aria-label="Post" onClick={() => router.push(phoneItems[0].href)}
          className="flex items-center justify-center text-ink-tertiary flex-shrink-0"
        >
          <Plus className="w-6 h-6" />
        </button>
        <PhoneNavItem item={phoneItems[2]} active={isActive(phoneItems[2].href)} />
        <button onClick={() => setProfileOpen(v => !v)} className={`flex flex-col items-center gap-0.5 ${profileOpen ? 'text-brand' : 'text-ink-tertiary'}`}>
          <UserIcon className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Profile</span>
        </button>
      </nav>
    </div>
  )
}

function PhoneNavItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} className={`flex flex-col items-center gap-0.5 ${active ? 'text-brand' : 'text-ink-tertiary'}`}>
      <item.icon className="w-5 h-5" />
      <span className="text-[10px] font-semibold">{item.label}</span>
    </Link>
  )
}
