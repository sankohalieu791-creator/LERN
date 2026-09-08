'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import LoginGreeting from '@/components/v2/LoginGreeting'
import { TextField, PrimaryButton, SecondaryButton, ErrorBanner, OrDivider, GoogleButton } from '@/components/v2/Field'
import { signUp, signIn, signInWithGoogle, claimEmployerRole, resendConfirmation, recordConsent, supabase } from '@/lib/supabase'
import { employerEmailError } from '@/lib/emailPolicy'
import { useAuth } from '@/context/AuthContext'
import { ShieldCheck } from 'lucide-react'

type Step = 1 | 2

// Employers are invite-only during the founder-testing phase — the
// access-lock allowlist enforced in handle_new_user() is the real gate;
// this form existing doesn't make signup open to anyone who finds the URL.
export default function EmployerSignupPage() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showGreeting, setShowGreeting] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [resent, setResent] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Covers landing back here after clicking the emailed confirmation
  // link, or right after a Google sign-in. Google carries no role
  // metadata, so a brand-new account arriving that way still has the
  // trigger's own default (role='student') -- claimEmployerRole()
  // corrects that once, before this page ever shows step 2. It's a
  // no-op (and harmless) for the email/password path, which already
  // has the right role from signUp() metadata.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('consented_at, full_name, role').eq('id', user.id).single()
      if (!profile) return
      // A Google sign-in skips the domain check handleStep1 does for
      // email/password, since Google supplies the email directly --
      // still enforced here, on whichever address they actually
      // authenticated with, for a brand-new (not-yet-consented,
      // still-default-role) account.
      if (profile.role === 'student' && !profile.consented_at) {
        const domainError = employerEmailError(user.email || '')
        if (domainError) {
          await supabase.auth.signOut()
          setError(domainError)
          return
        }
        await claimEmployerRole()
      }
      setFullName(profile.full_name || '')
      if (!profile.consented_at) setStep(2)
      else setShowGreeting(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError('')
    const { error: oauthError } = await signInWithGoogle(`${window.location.origin}/auth/callback?intent=employer`)
    if (oauthError) { setGoogleLoading(false); setError(oauthError.message) }
  }

  const handleStep1 = async () => {
    setError('')
    if (!fullName.trim()) return setError('Enter your name.')
    if (!email.trim()) return setError('Enter your email.')
    const domainError = employerEmailError(email.trim())
    if (domainError) return setError(domainError)
    if (password.length < 8) return setError('Password must be at least 8 characters.')

    setLoading(true)
    const redirectTo = typeof window !== 'undefined' ? window.location.origin + '/auth/signup/employer' : undefined
    const { data: signUpData, error: signUpError } = await signUp(email.trim(), password, { role: 'employer', full_name: fullName.trim() }, redirectTo)
    if (!signUpError) {
      setLoading(false)
      if (!signUpData.session) { setAwaitingConfirmation(true); return }
      setStep(2)
      return
    }

    if (signUpError.message?.toLowerCase().includes('already registered')) {
      const { data: signInData, error: signInError } = await signIn(email.trim(), password)
      if (!signInError && signInData?.user) {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const { data: profile } = await supabase.from('users').select('consented_at').eq('id', authUser.id).single()
          setLoading(false)
          if (profile && !profile.consented_at) { setStep(2); return }
          setShowGreeting(true)
          return
        }
      }
      setLoading(false)
      return setError('An account already exists for this email. If that’s you, double-check the password above, or log in instead.')
    }

    setLoading(false)
    setError(signUpError.message)
  }

  const handleConsent = async (accepted: boolean) => {
    if (!accepted) return setError('You need to accept to continue.')
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await recordConsent(user.id)
    await refreshUser()
    setLoading(false)
    setShowGreeting(true)
  }

  if (showGreeting) return <LoginGreeting name={fullName} onDone={() => router.replace('/employer')} />

  if (awaitingConfirmation) {
    return (
      <AuthShell title="Check your email" subtitle={`We've sent a confirmation link to ${email.trim()}.`}>
        <div className="bg-white border border-[#E2DDD1] rounded-2xl p-5 mb-6">
          <p className="text-[14px] text-[#4A453B] leading-relaxed">
            Click the link in that email to confirm it's really you — then you'll land right back here to carry on.
          </p>
        </div>
        <SecondaryButton
          onClick={async () => {
            setResent(false)
            const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/signup/employer` : undefined
            const { error } = await resendConfirmation(email.trim(), redirectTo)
            if (!error) setResent(true)
          }}
        >
          {resent ? 'Sent again' : "Didn't get it? Resend"}
        </SecondaryButton>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      step={step} totalSteps={2}
      title={step === 1 ? 'Create your employer account' : 'How LERN protects young people'}
      subtitle={step === 1 ? 'Browse verified work, set briefs, and track interest — all routed through the organisation.' : undefined}
    >
      <ErrorBanner message={error} />

      {step === 1 && (
        <div>
          <TextField label="Full name" value={fullName} onChange={setFullName} placeholder="Your name" autoFocus />
          <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" />
          <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" hint="Minimum 8 characters." />
          <PrimaryButton onClick={handleStep1} loading={loading}>Continue</PrimaryButton>
          <div className="mt-6">
            <OrDivider />
            <GoogleButton onClick={handleGoogle} loading={googleLoading} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="bg-white border border-[#E2DDD1] rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2.5 mb-3">
              <ShieldCheck className="w-5 h-5 text-brand flex-shrink-0" />
              <p className="font-bold text-ink text-[15px]">Before you browse</p>
            </div>
            <ul className="space-y-2.5 text-[14px] text-[#4A453B] leading-relaxed">
              <li>• You never get a young person's direct contact details. All contact — interview, offer, anything — is arranged through their organisation.</li>
              <li>• A brief you set is always verified by the student's own tutor, never by you.</li>
              <li>• Every step you take with a candidate is logged and visible to their organisation, so they always know what's happening.</li>
              <li>• An under-18's verified work can be seen, but they're never publicly identifiable or searchable as a person.</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => handleConsent(false)}>Decline</SecondaryButton>
            <PrimaryButton onClick={() => handleConsent(true)} loading={loading}>I understand, accept</PrimaryButton>
          </div>
        </div>
      )}
    </AuthShell>
  )
}
