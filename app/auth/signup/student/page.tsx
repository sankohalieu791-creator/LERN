'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import LoginGreeting from '@/components/v2/LoginGreeting'
import { TextField, PrimaryButton, SecondaryButton, ErrorBanner } from '@/components/v2/Field'
import { signUp, signIn, redeemJoinCode, recordConsent, getUserProfile, supabase } from '@/lib/supabase'
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
  const [showGreeting, setShowGreeting] = useState(false)

  // Resume an unfinished signup instead of re-running it -- e.g. an account
  // was created but never accepted the safeguarding step. A join code is
  // optional (explore-without-code), so it's no longer what decides
  // whether the signup is "finished" -- only consent is.
  const resumeFromSession = async (authUser: { id: string }) => {
    const { data: profile } = await getUserProfile(authUser.id)
    if (!profile || profile.role !== 'student') return false
    setFullName(profile.full_name || '')
    setEmail(profile.email || '')
    setDob(profile.date_of_birth || '')
    if (!profile.consented_at) setStep(3)
    else router.replace('/student')
    return true
  }

  // Covers a returning visitor who still has this browser's session live.
  useEffect(() => {
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) await resumeFromSession(authUser)
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
    if (!signUpError) { setLoading(false); setStep(2); return }

    // "Already registered" doesn't necessarily mean someone else's email --
    // it's very often the same person coming back to an unfinished signup
    // in a new tab/session with no live token to detect above. Try signing
    // them in with what they just typed instead of dead-ending on an error
    // they have no way to act on.
    if (signUpError.message?.toLowerCase().includes('already registered')) {
      const { data: signInData, error: signInError } = await signIn(email.trim(), password)
      if (!signInError && signInData?.user && await resumeFromSession(signInData.user)) {
        setLoading(false)
        return
      }
      setLoading(false)
      return setError('An account already exists for this email. If that’s you, double-check the password above, or log in instead.')
    }

    setLoading(false)
    setError(signUpError.message)
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
    setShowGreeting(true)
  }

  if (showGreeting) return <LoginGreeting name={fullName} onDone={() => router.replace('/student')} />

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
        : step === 2 ? 'Enter the code your school, college or training provider gave you — or skip this and add it later. Without one you can look around, but you can\'t post, submit work, or be seen by anyone.'
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
          <button
            onClick={() => { setError(''); setCode(''); setStep(3) }}
            className="block w-full text-center text-[13px] font-semibold text-[#8A8373] hover:text-ink transition mt-4"
          >
            I don't have a code yet — skip for now
          </button>
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
