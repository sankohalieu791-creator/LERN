'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/supabase'
import Logo from '@/components/v2/Logo'
import { ShieldCheck, Clock, LogOut, XCircle } from 'lucide-react'

// The employer vetting gate, per Michael's Sep-10 review: an
// independent employer sees exactly this instead of full access until
// employer_verified is set true by an admin (approve_employer_
// verification / the founder, in the early stage). Never shown to a
// guest/invited employer -- EmployerLayoutClient routes those to
// GuestEmployerShell before this component is ever reached.
export default function PendingEmployerVerification() {
  const { user } = useAuth()
  const router = useRouter()
  const rejected = !!user?.employer_rejected_reason

  const handleSignOut = async () => {
    await signOut()
    router.replace('/auth/login')
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mb-6 text-ink"><Logo size="lg" /></div>

      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: rejected ? '#FDEEEA' : '#FCEEE4' }}>
        {rejected ? <XCircle className="w-6 h-6" style={{ color: '#B3401E' }} /> : <Clock className="w-6 h-6" style={{ color: '#D4551A' }} />}
      </div>

      <h1 className="text-2xl font-bold text-ink mb-2">
        {rejected ? "We couldn't verify your account" : 'Your account is being reviewed'}
      </h1>
      <p className="text-[14px] text-[#6B6558] max-w-sm leading-relaxed mb-6">
        {rejected
          ? "We weren't able to confirm your business with the details you gave us. See the note below, then update your details from here to try again."
          : 'Every independent employer account is checked before it gets full access to Discover and candidates — usually quick during working hours. You\'ll be able to browse as soon as it\'s approved.'}
      </p>

      {rejected && user?.employer_rejected_reason && (
        <div className="w-full max-w-sm bg-white border border-[#F3C9BC] rounded-2xl p-4 mb-6 text-left">
          <p className="text-[12px] font-semibold text-[#B3401E] uppercase tracking-wide mb-1">Note from LERN</p>
          <p className="text-[13px] text-[#4A453B] leading-relaxed">{user.employer_rejected_reason}</p>
        </div>
      )}

      {(user?.employer_company_number || user?.employer_website) && (
        <div className="w-full max-w-sm bg-white border border-[#E2DDD1] rounded-2xl p-4 mb-6 text-left">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-brand flex-shrink-0" />
            <p className="font-bold text-ink text-[13px]">What you told us</p>
          </div>
          {user.employer_website && <p className="text-[13px] text-[#4A453B]">Website: {user.employer_website}</p>}
          {user.employer_company_number && <p className="text-[13px] text-[#4A453B] mt-1">Companies House: {user.employer_company_number}</p>}
        </div>
      )}

      <button onClick={handleSignOut} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-brand transition">
        <LogOut className="w-3.5 h-3.5" /> Sign out
      </button>
    </div>
  )
}
