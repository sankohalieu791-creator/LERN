'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import LoginGreeting from '@/components/v2/LoginGreeting'
import { TextField, PrimaryButton, ErrorBanner } from '@/components/v2/Field'
import { devLogin, getUser, getUserProfile } from '@/lib/supabase'
import { routeForRole } from '@/lib/roleRouting'
import { useAuth } from '@/context/AuthContext'

const SECRET_CACHE_KEY = 'lern_dev_login_secret'

// Testing-stage-only: passwordless sign-in for the founder allowlist.
// Not reachable from anywhere on the public site — you have to know
// this URL exists. Delete this page (and app/api/dev-login) once
// LERN opens up past the founder allowlist.
export default function DevLoginPage() {
  const [email, setEmail] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [greeting, setGreeting] = useState<{ name: string; dest: string } | null>(null)
  const router = useRouter()
  const { refreshUser } = useAuth()

  useEffect(() => {
    try { setSecret(localStorage.getItem(SECRET_CACHE_KEY) || '') } catch {}
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await devLogin(email.trim(), secret)
    if (err) {
      setLoading(false)
      setError(err.message || 'Could not sign in.')
      return
    }
    try { localStorage.setItem(SECRET_CACHE_KEY, secret) } catch {}
    const authUser = await getUser()
    const profile = authUser ? (await getUserProfile(authUser.id)).data : null
    await refreshUser()
    setLoading(false)
    setGreeting({ name: profile?.full_name || '', dest: routeForRole(profile?.role) })
  }

  if (greeting) return <LoginGreeting name={greeting.name} onDone={() => router.replace(greeting.dest)} />

  return (
    <AuthShell title="Dev login" subtitle="Testing stage only — allowlisted emails, no password.">
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit}>
        <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoFocus />
        <TextField label="Dev secret" type="password" value={secret} onChange={setSecret} placeholder="Shared testing secret" hint="Remembered in this browser after first use." />
        <PrimaryButton type="submit" loading={loading} disabled={!email || !secret}>Sign in</PrimaryButton>
      </form>
    </AuthShell>
  )
}
