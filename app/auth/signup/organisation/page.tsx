'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import LoginGreeting from '@/components/v2/LoginGreeting'
import { TextField, PrimaryButton, SecondaryButton, ErrorBanner, OrDivider, GoogleButton } from '@/components/v2/Field'
import {
  signUp, signIn, signInWithGoogle, resendConfirmation, createOrganisationAndJoin,
  redeemStaffJoinCode, recordConsent, generateJoinCode, randomJoinCode, getUserProfile, supabase,
} from '@/lib/supabase'
import { institutionEmailError } from '@/lib/emailPolicy'
import { useAuth } from '@/context/AuthContext'
import { ShieldCheck, Copy, Check } from 'lucide-react'

type Mode = 'create' | 'join'
type Step = 1 | 2 | 3 | 'orgname'
type OrgType = 'institution' | 'provider'

// Google Classroom/Teams both offer exactly this choice up front:
// create a new class/team, or join an existing one with a code --
// same shape here, since "how does a second teacher actually get
// onto the account" had no answer before this (create_organisation_
// and_join could only ever make a BRAND NEW organisation; nothing let
// someone join the one that already exists as staff, the way a
// student already could).
function OrganisationSignupInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useAuth()
  const orgType: OrgType = searchParams.get('type') === 'provider' ? 'provider' : 'institution'

  const [mode, setMode] = useState<Mode>('create')
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // O1 (create)
  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [leadName, setLeadName] = useState('')
  const [leadEmail, setLeadEmail] = useState('')

  // Join-existing-org path
  const [joinCode, setJoinCode] = useState('')

  // O3
  const [orgId, setOrgId] = useState<string | null>(null)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [resent, setResent] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Covers landing back here after clicking the emailed confirmation
  // link, or right after a Google sign-in -- both are a fresh page
  // load with a brand-new live session, same pattern as the student
  // wizard's resumeFromSession.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await getUserProfile(user.id)
      if (profile?.organisation_id && (profile.role === 'institution_staff' || profile.role === 'provider_staff')) {
        router.replace(profile.role === 'institution_staff' ? '/institution' : '/provider')
        return
      }
      if (profile?.role === 'student' && !profile.organisation_id) {
        setFullName(profile.full_name || '')
        setEmail(profile.email || '')
        const savedOrgName = (user.user_metadata?.org_name as string) || ''
        const savedMode = (user.user_metadata?.signup_mode as string) || 'create'
        setMode(savedMode === 'join' ? 'join' : 'create')
        setOrgName(savedOrgName)
        if (savedMode === 'join') { setStep(2); return }
        // org_name only exists in metadata for the email/password path
        // (set on step 1, before any confirmation link was clicked) --
        // a Google sign-in never had a step 1 at all, so there's no
        // name to resume with yet.
        setStep(savedOrgName ? 2 : 'orgname')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError('')
    const { error: oauthError } = await signInWithGoogle(`${window.location.origin}/auth/callback?intent=${orgType}`)
    if (oauthError) { setGoogleLoading(false); setError(oauthError.message) }
  }

  const handleOrgNameSubmit = async () => {
    setError('')
    if (!orgName.trim()) return setError(`Enter your ${orgType === 'institution' ? 'school or college' : 'organisation'}'s name.`)
    if (orgType === 'institution') {
      const domainError = institutionEmailError(email)
      if (domainError) return setError(domainError)
    }
    setStep(2)
  }

  const handleO1Submit = async () => {
    setError('')
    if (mode === 'create' && !orgName.trim()) return setError(`Enter your ${orgType === 'institution' ? 'school or college' : 'organisation'}'s name.`)
    if (mode === 'join' && !joinCode.trim()) return setError('Enter the staff join code your organisation gave you.')
    if (!fullName.trim()) return setError('Enter your name.')
    if (!email.trim()) return setError('Enter your email.')
    // Providers are deliberately not gated here — schools/colleges are the
    // strict case; a training provider's email is optional/lenient.
    if (orgType === 'institution') {
      const domainError = institutionEmailError(email.trim())
      if (domainError) return setError(domainError)
    }
    if (password.length < 8) return setError('Password must be at least 8 characters.')

    setLoading(true)
    const redirectTo = typeof window !== 'undefined' ? window.location.href.split('?')[0] + `?type=${orgType}` : undefined
    // org_name/signup_mode ride in the auth user's own metadata, not
    // just React state — a confirmation-link click is a fresh page
    // load, which would otherwise lose everything typed on this step.
    const { data: signUpData, error: signUpError } = await signUp(email.trim(), password, {
      role: 'student', full_name: fullName.trim(), org_name: mode === 'create' ? orgName.trim() : undefined, signup_mode: mode,
    } as any, redirectTo)
    // role is a placeholder here — create_organisation_and_join or
    // redeem_staff_join_code (step 1->2) overwrites it once the org
    // relationship is actually established.
    if (!signUpError) {
      setLoading(false)
      if (!signUpData.session) { setAwaitingConfirmation(true); return }
      setStep(2)
      return
    }

    // Same class of bug as the student wizard: someone coming back to an
    // unfinished org signup with no live session hits "already registered"
    // on step 1 with no way forward. Try signing them in with what they
    // just typed and resume from wherever they actually got to.
    if (signUpError.message?.toLowerCase().includes('already registered')) {
      const { data: signInData, error: signInError } = await signIn(email.trim(), password)
      if (!signInError && signInData?.user) {
        const { data: profile } = await getUserProfile(signInData.user.id)
        if (profile?.organisation_id && (profile.role === 'institution_staff' || profile.role === 'provider_staff')) {
          router.replace(profile.role === 'institution_staff' ? '/institution' : '/provider')
          return
        }
        if (profile?.role === 'student' && !profile.organisation_id) {
          setFullName(profile.full_name || fullName)
          setOrgName((signInData.user.user_metadata?.org_name as string) || orgName)
          setLoading(false)
          setStep(2)
          return
        }
      }
      setLoading(false)
      return setError('An account already exists for this email. If that’s you, double-check the password above, or log in instead.')
    }

    setLoading(false)
    setError(signUpError.message)
  }

  const handleAgreement = async (accepted: boolean) => {
    if (!accepted) {
      setError('You need to accept the safeguarding and data-processing terms to continue.')
      return
    }
    setError('')
    setLoading(true)

    if (mode === 'join') {
      const { error: joinError } = await redeemStaffJoinCode(joinCode.trim())
      if (joinError) { setLoading(false); return setError(joinError.message) }
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await recordConsent(user.id)
      await refreshUser()
      setLoading(false)
      setShowGreeting(true)
      return
    }

    const { data: newOrgId, error: orgError } = await createOrganisationAndJoin(orgName.trim(), orgType, fullName.trim(), leadName.trim(), leadEmail.trim())
    if (orgError || !newOrgId) { setLoading(false); return setError(orgError?.message || 'Could not create your organisation.') }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) await recordConsent(user.id)
    await refreshUser()

    const { data: codeRow, error: codeError } = await generateJoinCode(newOrgId, user!.id, randomJoinCode())
    setLoading(false)
    if (codeError || !codeRow) return setError('Organisation created, but the join code failed to generate — you can create one from your dashboard.')

    setOrgId(newOrgId)
    setGeneratedCode((codeRow as any).code)
    setStep(3)
  }

  const copyCode = () => {
    if (!generatedCode) return
    navigator.clipboard.writeText(generatedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (showGreeting) {
    return <LoginGreeting name={fullName} onDone={() => router.replace(orgType === 'institution' ? '/institution' : '/provider')} />
  }

  if (awaitingConfirmation) {
    return (
      <AuthShell title="Check your email" subtitle={`We've sent a confirmation link to ${email.trim()}.`}>
        <div className="bg-white border border-[#E2DDD1] rounded-2xl p-5 mb-6">
          <p className="text-[14px] text-[#4A453B] leading-relaxed">
            Click the link in that email to confirm it's really you — then you'll land right back here to carry on{mode === 'create' ? ` setting up ${orgName || 'your organisation'}` : ''}.
          </p>
        </div>
        <SecondaryButton
          onClick={async () => {
            setResent(false)
            const redirectTo = typeof window !== 'undefined' ? window.location.href.split('?')[0] + `?type=${orgType}` : undefined
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
      step={typeof step === 'number' ? step : 1}
      totalSteps={mode === 'join' ? 2 : 3}
      title={
        step === 'orgname' ? `Name your ${orgType === 'institution' ? 'school or college' : 'organisation'}`
        : step === 2 ? 'Safeguarding and data protection'
        : step === 3 ? 'You\'re set up'
        : mode === 'join' ? 'Join your organisation'
        : `Set up your ${orgType === 'institution' ? 'school or college' : 'organisation'}`
      }
      subtitle={
        step === 'orgname' ? 'Google already gave us your name and email — this creates your organisation\'s space on LERN.'
        : step === 2 ? 'This is the organisation-facing agreement. It reflects your signed Data Processing Schedule — it doesn\'t replace it.'
        : step === 3 ? 'Share this code with your students so they can join.'
        : mode === 'join' ? 'Enter the staff code your organisation gave you — you\'ll join with staff access, not as a student.'
        : 'This creates your organisation\'s space on LERN and makes you its first staff member.'
      }
    >
      <ErrorBanner message={error} />

      {step === 1 && (
        <div>
          {/* Same choice Google Classroom/Teams both put up front. */}
          <div className="flex gap-2 mb-6">
            {(['create', 'join'] as const).map(m => (
              <button
                key={m} type="button" onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition ${
                  mode === m ? 'bg-ink text-paper' : 'bg-white border border-[#E2DDD1] text-[#6B6558]'
                }`}
              >
                {m === 'create' ? 'Set up a new one' : 'Join an existing one'}
              </button>
            ))}
          </div>

          {mode === 'create' && (
            <TextField
              label={orgType === 'institution' ? 'School or college name' : 'Organisation name'}
              value={orgName} onChange={setOrgName} placeholder="Riverside College" autoFocus
            />
          )}
          {mode === 'join' && (
            <TextField
              label="Staff join code" value={joinCode} onChange={v => setJoinCode(v.toUpperCase())}
              placeholder="e.g. STAFF1" autoFocus
              hint="Ask whoever set up your organisation's LERN account for this."
            />
          )}
          <TextField label="Your full name" value={fullName} onChange={setFullName} placeholder="J. Ahmed" hint={mode === 'create' ? "You'll be named as the safeguarding lead by default — the person who sees the review logs. This can be reassigned later." : undefined} />
          <TextField label="Your email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" hint="Minimum 8 characters." />

          {mode === 'create' && (
            <>
              <div className="border-t border-[#E2DDD1] my-5 pt-5">
                <p className="text-[13px] font-semibold text-ink mb-1">Who's your safeguarding lead? (optional)</p>
                <p className="text-[12.5px] text-[#8A8373] mb-3 leading-relaxed">
                  If that's someone other than you, tell us their name and email now — the moment they sign up or join with a staff code using this exact email, LERN recognises them as the lead automatically. Leave this blank and you'll be the lead by default.
                </p>
                <TextField label="Safeguarding lead's name" value={leadName} onChange={setLeadName} placeholder="e.g. Priya Sharma" />
                <TextField label="Safeguarding lead's email" type="email" value={leadEmail} onChange={setLeadEmail} placeholder="lead@yourschool.ac.uk" />
              </div>
            </>
          )}

          <PrimaryButton onClick={handleO1Submit} loading={loading}>Continue</PrimaryButton>
          <div className="mt-6">
            <OrDivider />
            <GoogleButton onClick={handleGoogle} loading={googleLoading} />
          </div>
        </div>
      )}

      {step === 'orgname' && (
        <div>
          <TextField
            label={orgType === 'institution' ? 'School or college name' : 'Organisation name'}
            value={orgName} onChange={setOrgName} placeholder="Riverside College" autoFocus
          />
          <PrimaryButton onClick={handleOrgNameSubmit}>Continue</PrimaryButton>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="bg-white border border-[#E2DDD1] rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2.5 mb-3">
              <ShieldCheck className="w-5 h-5 text-brand flex-shrink-0" />
              <p className="font-bold text-ink text-[15px]">Safeguarding and data-processing position</p>
            </div>
            <ul className="space-y-2.5 text-[14px] text-[#4A453B] leading-relaxed">
              <li>• {orgName || 'Your organisation'} remains the data controller for your students' work and information — LERN acts as the processor, supporting you, not replacing your duty of care.</li>
              <li>• Every review your staff carry out is logged, append-only, and visible to your named safeguarding lead.</li>
              <li>• Under-18s' verified work is only ever visible within your own organisation unless they turn 18 and choose otherwise — LERN never lets a minor's work go public.</li>
              <li>• Employer interest in a student is routed to your organisation first. No employer can contact a young person directly through LERN.</li>
              <li>• This in-product agreement reflects your organisation's signed Data Processing Schedule. For a live pilot, the signed agreement is what governs — this doesn't replace it.</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => handleAgreement(false)}>Decline</SecondaryButton>
            <PrimaryButton onClick={() => handleAgreement(true)} loading={loading}>I agree, accept</PrimaryButton>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6 mb-6 text-center">
            <p className="text-[13px] font-semibold text-[#8A8373] uppercase tracking-wide mb-3">Your join code</p>
            <p className="text-4xl font-mono font-bold text-ink tracking-[0.15em] mb-4">{generatedCode}</p>
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-2 text-brand font-semibold text-[14px] hover:underline"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy code'}
            </button>
          </div>
          <p className="text-[14px] text-[#6B6558] mb-6 leading-relaxed">
            Students enter this code when they sign up to join {orgName}. Bringing on another teacher or tutor? Generate a separate staff join code from Settings instead — you can do that any time.
          </p>
          <PrimaryButton onClick={() => setShowGreeting(true)}>
            Continue
          </PrimaryButton>
        </div>
      )}
    </AuthShell>
  )
}

export default function OrganisationSignupPage() {
  return (
    <Suspense fallback={null}>
      <OrganisationSignupInner />
    </Suspense>
  )
}
