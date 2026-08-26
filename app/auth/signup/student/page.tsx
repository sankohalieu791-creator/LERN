'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import { TextField, PrimaryButton, SecondaryButton, ErrorBanner } from '@/components/v2/Field'
import { signUp, redeemJoinCode, recordConsent, getUserProfile, supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ShieldCheck } from 'lucide-react'

type Step = 1 | 2 | 3

const MIN_AGE = 5
const MAX_AGE = 100

function isPlausibleDob(dob: string): boolean {
  if (!dob) return false
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  const age = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  return age >= MIN_AGE && age <= MAX_AGE
}

export default function StudentSignupPage() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // A1
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [dob, setDob] = useState('')

  // A2
  const [code, setCode] = useState('')

  // Resume an unfinished signup instead of re-running it -- a returning
  // visitor who already has a session (created an account but never
  // entered a join code, or never accepted the safeguarding step) would
  // otherwise hit "User already registered" retrying step 1, or get
  // dumped on an empty dashboard by RoleGate. Land them back on whichever
  // step they actually still need.
  useEffect(() => {
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      const { data: profile } = await getUserProfile(authUser.id)
      if (!profile || profile.role !== 'student') return
      setFullName(profile.full_name || '')
      setEmail(profile.email || '')
      setDob(profile.date_of_birth || '')
      if (!profile.organisation_id) setStep(2)
      else if (!profile.consented_at) setStep(3)
      else router.replace('/student')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleA1Submit = async () => {
    setError('')
    if (!fullName.trim()) return setError('Enter your full name.')
    if (!email.trim()) return setError('Enter your email.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (!isPlausibleDob(dob)) return setError('Enter a valid date of birth.')

    setLoading(true)
    const { error: signUpError } = await signUp(email.trim(), password, {
      role: 'student', full_name: fullName.trim(), date_of_birth: dob,
    })
    setLoading(false)
    if (signUpError) return setError(signUpError.message)
    setStep(2)
  }

  const handleA2Submit = async () => {
    setError('')
    if (!code.trim()) return setError('Enter your join code.')
    setLoading(true)
    const { error: redeemError } = await redeemJoinCode(code)
    setLoading(false)
    if (redeemError) return setError('That code isn’t valid, has expired, or has been revoked. Check it with your school, college or provider.')
    setStep(3)
  }

  const handleConsent = async (accepted: boolean) => {
    if (!accepted) {
      setError('You need to accept to continue — you can come back to this later.')
      return
    }
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await recordConsent(user.id)
    await refreshUser()
    setLoading(false)
    router.replace('/student')
  }

  return (
    <AuthShell
      step={step}
      totalSteps={3}
      title={
        step === 1 ? 'Create your account'
        : step === 2 ? 'Join your organisation'
        : 'Keeping you safe'
      }
      subtitle={
        step === 1 ? 'Your date of birth drives every age-based rule on LERN — it’s never shown publicly.'
        : step === 2 ? 'Enter the code your school, college or training provider gave you. It tells us which organisation you belong to.'
        : undefined
      }
    >
      <ErrorBanner message={error} />

      {step === 1 && (
        <div>
          <TextField label="Full name" value={fullName} onChange={setFullName} placeholder="Amelia Grant" autoFocus />
          <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" hint="Minimum 8 characters." />
          <TextField label="Date of birth" type="date" value={dob} onChange={setDob} />
          <PrimaryButton onClick={handleA1Submit} loading={loading}>Continue</PrimaryButton>
        </div>
      )}

      {step === 2 && (
        <div>
          <TextField label="Join code" value={code} onChange={v => setCode(v.toUpperCase())} placeholder="e.g. 7K3P9XQZ" autoFocus />
          <PrimaryButton onClick={handleA2Submit} loading={loading}>Continue</PrimaryButton>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="bg-white border border-[#E2DDD1] rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2.5 mb-3">
              <ShieldCheck className="w-5 h-5 text-brand flex-shrink-0" />
              <p className="font-bold text-ink text-[15px]">How LERN keeps you safe</p>
            </div>
            <ul className="space-y-2.5 text-[14px] text-[#4A453B] leading-relaxed">
              <li>• Your work is reviewed by your own tutor at your school, college or provider — never by a stranger.</li>
              <li>• No employer or outside adult can contact you directly. Anything they want to say goes through your organisation first.</li>
              <li>• We only keep the information needed to run LERN safely: your name, email, date of birth, and the work you submit. It's stored securely and never shown publicly.</li>
              <li>• Your organisation can see your submitted work and your tutor's feedback on it. That's how the review process works.</li>
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
