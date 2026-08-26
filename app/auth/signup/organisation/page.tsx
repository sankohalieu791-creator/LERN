'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import { TextField, PrimaryButton, SecondaryButton, ErrorBanner } from '@/components/v2/Field'
import { signUp, createOrganisationAndJoin, recordConsent, generateJoinCode, supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ShieldCheck, Copy, Check } from 'lucide-react'

type Step = 1 | 2 | 3
type OrgType = 'institution' | 'provider'

function OrganisationSignupInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useAuth()
  const orgType: OrgType = searchParams.get('type') === 'provider' ? 'provider' : 'institution'

  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // O1
  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // O3
  const [orgId, setOrgId] = useState<string | null>(null)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleO1Submit = async () => {
    setError('')
    if (!orgName.trim()) return setError(`Enter your ${orgType === 'institution' ? 'school or college' : 'organisation'}'s name.`)
    if (!fullName.trim()) return setError('Enter your name.')
    if (!email.trim()) return setError('Enter your email.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')

    setLoading(true)
    const { error: signUpError } = await signUp(email.trim(), password, { role: 'student', full_name: fullName.trim() })
    // role is a placeholder here — create_organisation_and_join (step O1->O3)
    // overwrites it to institution_staff/provider_staff once the org exists.
    if (signUpError) { setLoading(false); return setError(signUpError.message) }
    setLoading(false)
    setStep(2)
  }

  const handleAgreement = async (accepted: boolean) => {
    if (!accepted) {
      setError('You need to accept the safeguarding and data-processing terms to continue.')
      return
    }
    setError('')
    setLoading(true)
    const { data: newOrgId, error: orgError } = await createOrganisationAndJoin(orgName.trim(), orgType, fullName.trim())
    if (orgError || !newOrgId) { setLoading(false); return setError(orgError?.message || 'Could not create your organisation.') }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) await recordConsent(user.id)
    await refreshUser()

    const { data: codeRow, error: codeError } = await generateJoinCode(newOrgId, user!.id, null)
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

  return (
    <AuthShell
      step={step}
      totalSteps={3}
      title={
        step === 1 ? `Set up your ${orgType === 'institution' ? 'school or college' : 'organisation'}`
        : step === 2 ? 'Safeguarding and data protection'
        : 'You\'re set up'
      }
      subtitle={
        step === 1 ? 'This creates your organisation\'s space on LERN and makes you its first staff member.'
        : step === 2 ? 'This is the organisation-facing agreement. It reflects your signed Data Processing Schedule — it doesn\'t replace it.'
        : 'Share this code with your students so they can join.'
      }
    >
      <ErrorBanner message={error} />

      {step === 1 && (
        <div>
          <TextField
            label={orgType === 'institution' ? 'School or college name' : 'Organisation name'}
            value={orgName} onChange={setOrgName} placeholder="Riverside College" autoFocus
          />
          <TextField label="Your full name" value={fullName} onChange={setFullName} placeholder="J. Ahmed" hint="You'll be named as the safeguarding lead — the person who sees the review logs. This can be reassigned later." />
          <TextField label="Your email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" hint="Minimum 8 characters." />
          <PrimaryButton onClick={handleO1Submit} loading={loading}>Continue</PrimaryButton>
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
            Students enter this code when they sign up to join {orgName}. You can generate more codes, set expiry dates, or revoke this one from your dashboard.
          </p>
          <PrimaryButton onClick={() => router.replace(orgType === 'institution' ? '/institution' : '/provider')}>
            Go to my dashboard
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
