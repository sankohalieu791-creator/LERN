'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import LoginGreeting from '@/components/v2/LoginGreeting'
import DemoRolePicker from '@/components/v2/DemoRolePicker'
import { TextField, PrimaryButton, ErrorBanner, OrDivider, GoogleButton } from '@/components/v2/Field'
import { signIn, signInWithGoogle, getUserProfile, resendConfirmation } from '@/lib/supabase'
import { routeForRole } from '@/lib/roleRouting'
import { useAuth } from '@/context/AuthContext'
import type { Role } from '@/lib/types'

// The public-facing quick-preview row (sign in with the demo
// credential + switch role in one tap, no typing) was removed -- a
// real login screen visible to anyone shouldn't be advertising a
// test-account switcher. The actual demo flow still works exactly as
// it did: type the one demo credential in the normal form below, and
// the role picker (DemoRolePicker) appears since that account is
// flagged is_demo_gateway -- same mechanism, just not surfaced to
// every visitor up front.
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [greeting, setGreeting] = useState<{ name: string; dest: string } | null>(null)
  const [showRolePicker, setShowRolePicker] = useState(false)
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
    if (profile?.is_demo_gateway) { setShowRolePicker(true); return }
    setGreeting({ name: profile?.full_name || '', dest: routeForRole(profile?.role) })
  }

  const handleDemoSwitched = async (role: Role) => {
    await refreshUser()
    setGreeting({ name: '', dest: routeForRole(role) })
  }

  if (greeting) return <LoginGreeting name={greeting.name} onDone={() => router.replace(greeting.dest)} />

  if (showRolePicker) {
    return (
      <AuthShell title="Choose a view" subtitle="Pick a role to look around as — switch any time from here.">
        <DemoRolePicker onSwitched={handleDemoSwitched} />
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your LERN account.">
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
