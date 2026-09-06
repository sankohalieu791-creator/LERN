'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import LoginGreeting from '@/components/v2/LoginGreeting'
import { TextField, PrimaryButton, SecondaryButton, ErrorBanner, OrDivider, GoogleButton } from '@/components/v2/Field'
import { signUp, signIn, signInWithGoogle, resendConfirmation, redeemJoinCode, recordConsent, updateUserProfile, getUserProfile, supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ShieldCheck } from 'lucide-react'

type Step = 1 | 2 | 3 | 'dob'

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
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [resent, setResent] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

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
    // A Google sign-in never collects a date of birth on the way in --
    // Google doesn't have one to give us -- so that's the one thing
    // still missing for a brand-new account arriving this way, even
    // though name/email/password (or lack of a password entirely) are
    // already settled.
    if (!profile.date_of_birth) setStep('dob')
    else if (!profile.consented_at) setStep(3)
    else router.replace('/student')
    return true
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError('')
    const { error: oauthError } = await signInWithGoogle(`${window.location.origin}/auth/callback?intent=student`)
    if (oauthError) { setGoogleLoading(false); setError(oauthError.message) }
  }

  const handleDobSubmit = async () => {
    setError('')
    if (!isPlausibleDob(dob)) return setError('Enter a valid date of birth.')
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error: updateError } = await updateUserProfile(user.id, { date_of_birth: dob })
      if (updateError) { setLoading(false); setError(updateError.message); return }
    }
    setLoading(false)
    setStep(2)
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
    const { data: signUpData, error: signUpError } = await signUp(email.trim(), password, {
      role: 'student', full_name: fullName.trim(), date_of_birth: dob,
    }, typeof window !== 'undefined' ? `${window.location.origin}/auth/signup/student` : undefined)
    if (!signUpError) {
      setLoading(false)
      // No session back means the project requires clicking a
      // confirmation link before this account is real — the point of
      // that setting existing at all. Clicking the emailed link lands
      // back on this exact page with a live session, and the
      // resumeFromSession check on mount picks up from here.
      if (!signUpData.session) { setAwaitingConfirmation(true); return }
      setStep(2)
      return
    }

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

  if (awaitingConfirmation) {
    return (
      <AuthShell title="Check your email" subtitle={`We've sent a confirmation link to ${email.trim()}.`}>
        <div className="bg-white border border-[#E2DDD1] rounded-2xl p-5 mb-6">
          <p className="text-[14px] text-[#4A453B] leading-relaxed">
            Click the link in that email to confirm it's really you — then you'll land right back here to carry on. This is what proves the account belongs to whoever owns that inbox, not just whoever typed it in.
          </p>
        </div>
        <SecondaryButton
          onClick={async () => { setResent(false); const { error } = await resendConfirmation(email.trim()); if (!error) setResent(true) }}
        >
          {resent ? 'Sent again' : "Didn't get it? Resend"}
        </SecondaryButton>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      step={typeof step === 'number' ? step : 1}
      totalSteps={3}
      title={
        step === 1 ? 'Create your account'
        : step === 'dob' ? 'One more thing'
        : step === 2 ? 'Join your organisation'
        : 'Keeping you safe'
      }
      subtitle={
        step === 1 ? 'Your date of birth drives every age-based rule on LERN — it’s never shown publicly.'
        : step === 'dob' ? 'Google doesn\'t share this with us — your date of birth drives every age-based rule on LERN, and it\'s never shown publicly.'
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
          <div className="mt-6">
            <OrDivider />
            <GoogleButton onClick={handleGoogle} loading={googleLoading} />
          </div>
        </div>
      )}

      {step === 'dob' && (
        <div>
          <TextField label="Date of birth" type="date" value={dob} onChange={setDob} autoFocus />
          <PrimaryButton onClick={handleDobSubmit} loading={loading}>Continue</PrimaryButton>
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
