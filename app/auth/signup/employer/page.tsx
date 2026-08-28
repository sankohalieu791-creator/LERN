'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import LoginGreeting from '@/components/v2/LoginGreeting'
import { TextField, PrimaryButton, SecondaryButton, ErrorBanner } from '@/components/v2/Field'
import { signUp, signIn, recordConsent, supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ShieldCheck } from 'lucide-react'

type Step = 1 | 2

// Employers are invite-only — reached via the hidden "Founder access"
// link on /auth/start, not a public CTA. The access-lock allowlist
// enforced in handle_new_user() is the real gate; this form existing
// doesn't make signup open to anyone who finds the URL.
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

  const handleStep1 = async () => {
    setError('')
    if (!fullName.trim()) return setError('Enter your name.')
    if (!email.trim()) return setError('Enter your email.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')

    setLoading(true)
    const { error: signUpError } = await signUp(email.trim(), password, { role: 'employer', full_name: fullName.trim() })
    if (!signUpError) { setLoading(false); setStep(2); return }

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
