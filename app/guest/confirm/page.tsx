'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { recordConsent } from '@/lib/supabase'
import AuthShell from '@/components/v2/AuthShell'

// Where the guest's magic link actually lands. Supabase's client picks
// the session up from the URL automatically; once `user` shows up here
// we just record the consent they already agreed to on the claim page
// (no second screen needed for something they already said yes to)
// and drop them straight into their scoped view.
export default function GuestConfirmPage() {
  const { user, loading, refreshUser } = useAuth()
  const router = useRouter()
  const handled = useRef(false)

  useEffect(() => {
    if (loading || !user || handled.current) return
    handled.current = true
    ;(async () => {
      if (!user.consented_at) {
        await recordConsent(user.id)
        await refreshUser()
      }
      router.replace('/employer')
    })()
  }, [user, loading, router, refreshUser])

  return (
    <AuthShell title="Signing you in…">
      <div className="flex justify-center py-10">
        <span className="w-6 h-6 border-2 border-[#E2DDD1] border-t-brand rounded-full animate-spin" />
      </div>
    </AuthShell>
  )
}
