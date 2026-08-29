'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import { ErrorBanner } from '@/components/v2/Field'
import { devLogin, getUser, getUserProfile } from '@/lib/supabase'
import { routeForRole } from '@/lib/roleRouting'
import { useAuth } from '@/context/AuthContext'
import { Hammer } from 'lucide-react'
import type { Role } from '@/lib/types'

const SECRET_CACHE_KEY = 'lern_dev_login_secret'

// One test account per role, matching the founder allowlist 1:1 —
// picking a role here is a one-click sign-in as that account (via the
// same passwordless dev-login mechanism as /auth/dev-login), not a
// real signup. Testing-stage-only, same as dev-login itself: revert
// this whole reveal back to real signup links once LERN opens up.
const TEST_ACCOUNTS: Record<Role, { email: string; label: string }> = {
  student: { email: 'sankohalieu791@gmail.com', label: 'Student' },
  institution_staff: { email: 'alieu@joinirl.co.uk', label: 'School / college' },
  provider_staff: { email: 'mohalieu58@gmail.com', label: 'Training provider' },
  employer: { email: 'sankohaugusta9@gmail.com', label: 'Employer' },
}

export default function ChooseRolePage() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [revealed, setRevealed] = useState(false)
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [busyRole, setBusyRole] = useState<Role | null>(null)

  useEffect(() => {
    try { setSecret(localStorage.getItem(SECRET_CACHE_KEY) || '') } catch {}
  }, [])

  const quickLogin = async (role: Role) => {
    setError('')
    if (!secret) { router.push(`/auth/dev-login?next=/auth/start`); return }
    setBusyRole(role)
    const { error: err } = await devLogin(TEST_ACCOUNTS[role].email, secret)
    if (err) {
      setBusyRole(null)
      setError(err.message || 'Could not sign in.')
      return
    }
    const authUser = await getUser()
    const profile = authUser ? (await getUserProfile(authUser.id)).data : null
    await refreshUser()
    setBusyRole(null)
    router.replace(routeForRole(profile?.role))
  }

  return (
    <AuthShell title="Being built" subtitle="LERN isn't open yet — check back soon.">
      <div className="flex flex-col items-center text-center py-10">
        <div className="w-14 h-14 rounded-2xl bg-[#FCEEE4] flex items-center justify-center mb-5">
          <Hammer className="w-6 h-6 text-brand" />
        </div>
        <p className="text-[14px] text-[#6B6558] max-w-xs leading-relaxed">
          We're still putting LERN together. There's nothing to sign up for yet — come back once it's live.
        </p>
      </div>

      {revealed ? (
        <div className="space-y-3">
          <ErrorBanner message={error} />
          {(Object.keys(TEST_ACCOUNTS) as Role[]).map(role => (
            <button
              key={role}
              onClick={() => quickLogin(role)}
              disabled={busyRole !== null}
              className="w-full flex items-center justify-center bg-white border border-[#E2DDD1] rounded-2xl px-5 py-3.5 text-[14px] font-semibold text-ink hover:border-brand transition disabled:opacity-50"
            >
              {busyRole === role ? 'Signing in…' : TEST_ACCOUNTS[role].label}
            </button>
          ))}
        </div>
      ) : (
        <button onClick={() => setRevealed(true)} className="block mx-auto text-[12px] text-[#C9C2B2] hover:text-[#8A8373] transition">
          Founder access
        </button>
      )}

      <p className="text-center text-[13px] text-[#8A8373] mt-8">
        Already have an account?{' '}
        <button onClick={() => router.push('/auth/login')} className="text-brand font-semibold hover:underline">
          Log in
        </button>
      </p>
    </AuthShell>
  )
}
