'use client'

import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function DashboardShell({ orgName, children }: { orgName?: string | null; children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.replace('/auth/login')
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-[#EDE9E1] px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-ink">LERN</span>
          {orgName && (
            <>
              <span className="text-[#C9C2B2]">/</span>
              <span className="text-[15px] font-semibold text-[#6B6558]">{orgName}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[14px] text-[#6B6558]">{user?.full_name}</span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-[14px] font-semibold text-[#6B6558] hover:text-ink transition"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      </header>
      <main className="px-10 py-10 max-w-5xl mx-auto">{children}</main>
    </div>
  )
}
