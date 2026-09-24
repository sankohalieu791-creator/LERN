'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getMyOrganisation, signOut } from '@/lib/supabase'
import PendingOrgVerification from '@/components/v2/PendingOrgVerification'
import Logo from '@/components/v2/Logo'
import { LogOut } from 'lucide-react'

type State = 'loading' | 'no-org' | 'load-error' | 'pending' | 'verified'

// Sits in front of OrgBillingGate (verify, then bill, then in) --
// organisation.verified isn't on the user object the way employer_
// verified is, so this fetches it once per load rather than adding a
// join everywhere else that reads `user`. Three failure modes handled
// explicitly (never just "still loading" forever): no organisation_id
// at all (e.g. the org was deleted out from under this account), a
// genuine fetch error, and the real pending/verified split.
export default function OrgVerificationGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    if (!user) return
    if (!user.organisation_id) { setState('no-org'); return }
    getMyOrganisation(user.organisation_id).then(({ data, error }) => {
      if (error || !data) { setState('load-error'); return }
      setState(data.verified ? 'verified' : 'pending')
    })
  }, [user?.organisation_id, user])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/auth/login')
  }

  if (state === 'loading') return <div className="min-h-screen bg-paper" />
  if (state === 'pending') return <PendingOrgVerification />
  if (state === 'verified') return <>{children}</>

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mb-6 text-ink"><Logo size="lg" /></div>
      <h1 className="text-2xl font-bold text-ink mb-2">
        {state === 'no-org' ? "You're not part of an organisation" : "Couldn't load your account"}
      </h1>
      <p className="text-[14px] text-[#6B6558] max-w-sm leading-relaxed mb-6">
        {state === 'no-org'
          ? 'This account isn\'t linked to a school or training provider anymore. Contact LERN if this is unexpected.'
          : 'Check your connection and try again.'}
      </p>
      <button onClick={handleSignOut} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-brand transition">
        <LogOut className="w-3.5 h-3.5" /> Sign out
      </button>
    </div>
  )
}
