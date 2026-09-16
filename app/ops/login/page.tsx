'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import { TextField, PrimaryButton, ErrorBanner } from '@/components/v2/Field'
import { signIn } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

// Build Spec: Internal Ops Tool v1.0 -- "reachable only by LERN admin
// accounts", so this is its own login, entirely separate from
// /auth/login (which routes by customer role and has customer-facing
// copy/branding around it). Whether the resulting account is actually
// allowed in is decided by RoleGate (allow="ops_admin") in
// app/ops/layout.tsx, not here -- this page only signs in.
export default function OpsLoginPage() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!email.trim() || !password) return setError('Enter your email and password.')
    setLoading(true)
    const { error: signInError } = await signIn(email.trim(), password)
    if (signInError) { setLoading(false); return setError('Incorrect email or password.') }
    await refreshUser()
    setLoading(false)
    router.replace('/ops')
  }

  return (
    <AuthShell title="LERN Ops" subtitle="Internal tool — LERN team only." onBack={() => router.push('/')}>
      <ErrorBanner message={error} />
      <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@opstool.co.uk" autoFocus />
      <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder="Password" />
      <PrimaryButton onClick={handleSubmit} loading={loading}>Sign in</PrimaryButton>
    </AuthShell>
  )
}
