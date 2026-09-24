'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/supabase'
import Logo from '@/components/v2/Logo'
import { Clock, LogOut } from 'lucide-react'

// Institution/provider equivalent of PendingEmployerVerification -- one
// state only (pending), no automated checks to report back since there
// aren't any yet (see get_pending_organisations()/approve_organisation()
// in the 2026-09-24-org-verification-gate migration). An ops admin
// approves manually from /ops/organisations; organisations.verified
// flips true and this stops being shown, same as employer_verified.
export default function PendingOrgVerification() {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.replace('/auth/login')
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mb-6 text-ink"><Logo size="lg" /></div>
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: '#FCEEE4' }}>
        <Clock className="w-6 h-6" style={{ color: '#D4551A' }} />
      </div>
      <h1 className="text-2xl font-bold text-ink mb-2">Your organisation is under review</h1>
      <p className="text-[14px] text-[#6B6558] max-w-sm leading-relaxed mb-6">
        We check every new school and training provider before granting access to student data. We'll notify you once it's approved — this is usually quick.
      </p>
      <button onClick={handleSignOut} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-brand transition">
        <LogOut className="w-3.5 h-3.5" /> Sign out
      </button>
    </div>
  )
}
