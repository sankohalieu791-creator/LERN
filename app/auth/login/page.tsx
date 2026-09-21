'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import LoginGreeting from '@/components/v2/LoginGreeting'
import { TextField, PrimaryButton, ErrorBanner, OrDivider, GoogleButton } from '@/components/v2/Field'
import { signIn, signInWithGoogle, getUserProfile, resendConfirmation } from '@/lib/supabase'
import { routeForRole } from '@/lib/roleRouting'
import { useAuth } from '@/context/AuthContext'

// The "sign in with one shared credential, then pick which role to look
// around as" preview flow (a "Choose a view" screen after login) has
// been removed outright, not just hidden -- it meant one login could
// switch into any of several accounts by role, which is a real
// safeguarding problem on a platform where some of those accounts
// belong to under-18s. Every sign-in now goes straight to the one real
// account that email belongs to, full stop.
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [greeting, setGreeting] = useState<{ name: string; dest: string } | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resent, setResent] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const router = useRouter()
  const { refreshUser } = useAuth()

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError('')
    const { error: oauthError } = await signInWithGoogle(`${window.location.origin}/auth/callback`)
    if (oauthError) { setGoogleLoading(false); setError(oauthError.message) }
    // No further handling on success — signInWithOAuth navigates the
    // whole page away to Google, there's nothing left to update here.
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setUnconfirmed(false)
    setLoading(true)
    const { data, error: signInError } = await signIn(email.trim(), password)
    if (signInError || !data.user) {
      setLoading(false)
      // Supabase's own wording for this ("Email not confirmed") reads like
      // a bug report, not something the person can act on — swap it for
      // the actual next step, with a way to get another link right there.
      if (signInError?.message?.toLowerCase().includes('email not confirmed')) {
        setUnconfirmed(true)
        setError('Confirm your email before logging in — check your inbox for the link we sent when you signed up.')
        return
      }
      setError(signInError?.message || 'Could not sign in.')
      return
    }
    // Role/org routing reads from the verified database row, not
    // anything client-side — a student can't reach an org view by
    // guessing a URL, since that destination page checks role itself too.
    const { data: profile } = await getUserProfile(data.user.id)
    await refreshUser()
    setLoading(false)

    // An organisation signup uses role: 'student' as a placeholder until
    // the org actually gets created -- signup_mode only ever gets set by
    // that flow. Without this check, confirming the email and then just
    // logging in normally (rather than remembering to click the emailed
    // link specifically) dropped someone mid-way through setting up a
    // school straight into the student app instead of back into their
    // own unfinished signup.
    const signupMode = data.user.user_metadata?.signup_mode
    if (profile?.role === 'student' && !profile.organisation_id && signupMode) {
      const orgType = data.user.user_metadata?.org_type === 'provider' ? 'provider' : 'institution'
      setGreeting({ name: profile?.full_name || '', dest: `/auth/signup/organisation?type=${orgType}` })
      return
    }

    setGreeting({ name: profile?.full_name || '', dest: routeForRole(profile?.role) })
  }

  if (greeting) return <LoginGreeting name={greeting.name} onDone={() => router.replace(greeting.dest)} />

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your LERN account." onBack={() => router.push('/')}>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit}>
        <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoFocus />
        <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder="Your password" />
        <PrimaryButton type="submit" loading={loading} disabled={!email || !password}>Log in</PrimaryButton>
      </form>
      {unconfirmed && (
        <button
          type="button"
          onClick={async () => { setResent(false); const { error } = await resendConfirmation(email.trim()); if (!error) setResent(true) }}
          className="block w-full text-center text-[13px] font-semibold text-brand hover:underline mt-4"
        >
          {resent ? 'Sent again — check your inbox' : 'Resend confirmation email'}
        </button>
      )}
      <div className="mt-6">
        <OrDivider />
        <GoogleButton onClick={handleGoogle} loading={googleLoading} />
      </div>
      <p className="text-center text-[13px] text-[#8A8373] mt-6">
        New to LERN?{' '}
        <button onClick={() => router.push('/auth/start')} className="text-brand font-semibold hover:underline">
          Sign up
        </button>
      </p>
    </AuthShell>
  )
}
