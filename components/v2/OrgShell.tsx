'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { setSidebarCollapsed, signOut, supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, Bell, Settings, User as UserIcon, Plus, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Logo from '@/components/v2/Logo'

export interface NavItem { key: string; label: string; icon: LucideIcon; href: string }

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
  const { user } = useAuth()
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
    <div className="min-h-screen bg-paper flex">
      {/* ── Laptop sidebar ── */}
      <aside className={`hidden lg:flex flex-col border-r border-[#EDE9E1] bg-white transition-[width] duration-150 flex-shrink-0 ${collapsed ? 'w-[72px]' : 'w-60'}`}>
        <div className={`flex items-center h-16 px-4 flex-shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && <Logo />}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F5F1E8] text-[#6B6558] transition flex-shrink-0"
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
                isActive(s.href) ? 'bg-[#FCEEE4] text-brand' : 'text-[#6B6558] hover:bg-[#F5F1E8]'
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
        <header className="flex items-center justify-between h-16 px-5 lg:px-8 border-b border-[#EDE9E1] flex-shrink-0">
          <div className="lg:hidden"><Logo size="sm" /></div>
          <div className="hidden lg:block text-[14px] font-semibold text-[#6B6558] truncate">{orgName}</div>
          <div className="flex items-center gap-1">
            <button aria-label="Notifications" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F5F1E8] text-[#6B6558] transition">
              <Bell className="w-[18px] h-[18px]" />
            </button>
            <button aria-label="Settings" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F5F1E8] text-[#6B6558] transition">
              <Settings className="w-[18px] h-[18px]" />
            </button>
            <div className="relative">
              <button
                onClick={() => setProfileOpen(v => !v)}
                aria-label="Profile menu"
                className="w-9 h-9 flex items-center justify-center rounded-full bg-[#FCEEE4] text-brand font-bold text-[13px] ml-1"
              >
                {user?.full_name?.[0]?.toUpperCase() || <UserIcon className="w-4 h-4" />}
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-11 bg-white border border-[#E2DDD1] rounded-xl shadow-lg py-1.5 w-48 z-20">
                    <div className="px-3.5 py-2 border-b border-[#EDE9E1]">
                      <p className="text-[13px] font-semibold text-ink truncate">{user?.full_name}</p>
                      <p className="text-[12px] text-[#8A8373] truncate">{user?.email}</p>
                    </div>
                    <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-[#6B6558] hover:bg-[#F5F1E8] transition">
                      <LogOut className="w-3.5 h-3.5" /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 lg:px-10 py-7 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* ── Phone bottom nav ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#EDE9E1] flex items-center justify-around h-16 z-10">
        <PhoneNavItem item={phoneItems[0]} active={isActive(phoneItems[0].href)} />
        <PhoneNavItem item={phoneItems[1]} active={isActive(phoneItems[1].href)} />
        <button
          aria-label="Post" onClick={() => router.push(phoneItems[0].href)}
          className="flex items-center justify-center text-[#8A8373] flex-shrink-0"
        >
          <Plus className="w-6 h-6" />
        </button>
        <PhoneNavItem item={phoneItems[2]} active={isActive(phoneItems[2].href)} />
        <button onClick={() => setProfileOpen(v => !v)} className={`flex flex-col items-center gap-0.5 ${profileOpen ? 'text-brand' : 'text-[#8A8373]'}`}>
          <UserIcon className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Profile</span>
        </button>
      </nav>
    </div>
  )
}

function PhoneNavItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} className={`flex flex-col items-center gap-0.5 ${active ? 'text-brand' : 'text-[#8A8373]'}`}>
      <item.icon className="w-5 h-5" />
      <span className="text-[10px] font-semibold">{item.label}</span>
    </Link>
  )
}
