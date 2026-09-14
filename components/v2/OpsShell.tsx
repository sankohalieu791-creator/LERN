'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from '@/lib/supabase'
import Logo from '@/components/v2/Logo'
import { LayoutDashboard, Building2, Flag, ShieldAlert, ClipboardList, ScrollText, LogOut } from 'lucide-react'

const NAV = [
  { href: '/ops', label: 'Overview', icon: LayoutDashboard },
  { href: '/ops/employers', label: 'Employer verification', icon: Building2 },
  { href: '/ops/reports', label: 'Content reports', icon: Flag },
  { href: '/ops/concerns', label: 'Safeguarding concerns', icon: ShieldAlert },
  { href: '/ops/dbs', label: 'DBS & sessions', icon: ClipboardList },
  { href: '/ops/audit', label: 'Audit log', icon: ScrollText },
]

// Build Spec: Internal Ops Tool v1.0 -- one plain admin shell, no
// customer-facing chrome (no OrgShell reuse), so this can never be
// mistaken for a product surface. Every link here is only ever reached
// past OpsGate (allow ops_admin only).
export default function OpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.replace('/ops/login')
  }

  return (
    <div className="min-h-screen bg-paper flex">
      <aside className="w-60 flex-shrink-0 border-r border-edge-subtle flex flex-col py-5 px-3">
        <div className="px-2 mb-6"><Logo size="sm" /></div>
        <nav className="flex-1 space-y-1">
          {NAV.map(item => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href} href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition ${active ? 'bg-accent-bg text-brand' : 'text-ink-secondary hover:bg-surface-muted'}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" /> {item.label}
              </Link>
            )
          })}
        </nav>
        <button onClick={handleSignOut} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold text-ink-tertiary hover:text-danger-text hover:bg-surface-muted transition">
          <LogOut className="w-4 h-4 flex-shrink-0" /> Sign out
        </button>
      </aside>
      <main className="flex-1 px-8 py-7 overflow-y-auto">{children}</main>
    </div>
  )
}
