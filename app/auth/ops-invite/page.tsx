'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import { TextField, PrimaryButton, ErrorBanner } from '@/components/v2/Field'
import { supabase, getOpsInviteByToken, acceptOpsInvite } from '@/lib/supabase'

// Public accept screen for an ops invite (see app/ops/invite/page.tsx
// and accept_ops_invite() in the database). The account created here
// is a completely ordinary signup -- role defaults to 'student' just
// like any other -- accept_ops_invite() is the one and only thing that
// ever turns it into ops_admin, and it independently re-checks the
// token and the matching email server-side before doing that.
function OpsInviteInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') || ''

  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState<{ email: string; valid: boolean } | null>(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    ;(async () => {
      const { data } = await getOpsInviteByToken(token)
      setInvite(data || null)

      // Covers landing back here after clicking the emailed confirmation
      // link -- a fresh page load with a brand-new live session, same
      // pattern every other signup wizard in this app uses to resume.
      const { data: { user } } = await supabase.auth.getUser()
      if (user && data?.valid && user.email?.toLowerCase() === data.email.toLowerCase()) {
        const { error: acceptError } = await acceptOpsInvite(token)
        if (!acceptError) { router.replace('/ops'); return }
      }
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const submit = async () => {
    setError('')
    if (!fullName.trim()) return setError('Enter your name.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    setSubmitting(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: invite!.email,
      password,
      options: { data: { full_name: fullName.trim() } },
    })
    if (signUpError) { setSubmitting(false); return setError(signUpError.message) }

    if (!data.session) {
      // Email confirmation is on -- same as every other signup flow,
      // acceptOpsInvite() runs once they're actually back with a live
      // session, not here.
      setSubmitting(false)
      setAwaitingConfirmation(true)
      return
    }

    const { error: acceptError } = await acceptOpsInvite(token)
    setSubmitting(false)
    if (acceptError) return setError(acceptError.message)
    router.replace('/ops')
  }

  if (loading) {
    return (
      <AuthShell title="Ops invite">
        <p className="text-[14px] text-[#6B6558]">Checking your invite…</p>
      </AuthShell>
    )
  }

  if (!token || !invite || !invite.valid) {
    return (
      <AuthShell title="Invite not valid">
        <p className="text-[14px] text-[#6B6558] leading-relaxed">
          This invite link has expired, already been used, or doesn't exist. Ask whoever invited you to send a new one.
        </p>
      </AuthShell>
    )
  }

  if (awaitingConfirmation) {
    return (
      <AuthShell title="Check your email" subtitle={`We've sent a confirmation link to ${invite.email}.`}>
        <div className="bg-white border border-[#E2DDD1] rounded-2xl p-5">
          <p className="text-[14px] text-[#4A453B] leading-relaxed">
            Click the link in that email, then come back and log in — your ops access will already be waiting.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Join LERN Ops" subtitle={`Set a password for ${invite.email} to finish joining.`}>
      <ErrorBanner message={error} />
      <TextField label="Your full name" value={fullName} onChange={setFullName} placeholder="J. Ahmed" autoFocus />
      <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" hint="Minimum 8 characters." />
      <PrimaryButton onClick={submit} loading={submitting}>Create account</PrimaryButton>
    </AuthShell>
  )
}

export default function OpsInvitePage() {
  return (
    <Suspense fallback={null}>
      <OpsInviteInner />
    </Suspense>
  )
}
