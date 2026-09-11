'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/supabase'
import Logo from '@/components/v2/Logo'
import { LogOut } from 'lucide-react'

// Deliberately not OrgShell — a guest has no sidebar, no Discover, no
// Opportunities, nothing to navigate to. This is the whole point of
// "guest, not a customer": one screen, exactly what was shared, and a
// way to leave.
//
// Michael's Sep-10 review found this shell rendered whatever route a
// guest actually landed on (this was only ever true by omission -- it
// never restricted which page could render inside it), so a guest
// typing /employer/feed or any other employer URL by hand got the real
// page underneath, no different from a real account. This effect is
// the actual hard block: any path other than /employer/shared bounces
// straight back, independent of the nav simply not linking anywhere
// else.
export default function GuestEmployerShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== '/employer/shared') router.replace('/employer/shared')
  }, [pathname, router])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/auth/login')
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between h-16 px-5 lg:px-8 border-b border-edge-subtle">
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-ink-tertiary hidden sm:inline">{user?.full_name}</span>
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-brand transition">
            <LogOut className="w-3.5 h-3.5" /> Log out
          </button>
        </div>
      </header>
      <main className="px-5 lg:px-10 py-7">{children}</main>
    </div>
  )
}
