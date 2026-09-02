'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import LoginGreeting from '@/components/v2/LoginGreeting'
import DemoRolePicker from '@/components/v2/DemoRolePicker'
import { TextField, PrimaryButton, ErrorBanner } from '@/components/v2/Field'
import { signIn, getUserProfile } from '@/lib/supabase'
import { routeForRole } from '@/lib/roleRouting'
import { useAuth } from '@/context/AuthContext'
import type { Role } from '@/lib/types'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [greeting, setGreeting] = useState<{ name: string; dest: string } | null>(null)
  // The one public demo credential (Lern12@gmail.com) doesn't route
  // straight into a dashboard — it lands here instead, so a visitor
  // picks which of the 4 real roles to look around as.
  const [showRolePicker, setShowRolePicker] = useState(false)
  const router = useRouter()
  const { refreshUser } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: signInError } = await signIn(email.trim(), password)
    if (signInError || !data.user) {
      setLoading(false)
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

  // "Choose school and press log in" as one actual tap, not type the
  // demo credential first and only THEN get offered the role picker.
  // Signs in with the one public demo credential and switches straight
  // to the picked role in a single action — no separate typing step.
  const [demoBusy, setDemoBusy] = useState<Role | null>(null)
  const quickPreview = async (role: Role) => {
    setError(''); setDemoBusy(role)
    const { data, error: signInError } = await signIn('Lern12@gmail.com', 'Lerntesterapp')
    if (signInError || !data.user) { setDemoBusy(null); setError('Could not reach the demo account — try again.'); return }
    await refreshUser()
    await handleDemoSwitched(role)
    setDemoBusy(null)
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
      <p className="text-center text-[13px] text-[#8A8373] mt-6">
        New to LERN?{' '}
        <button onClick={() => router.push('/auth/start')} className="text-brand font-semibold hover:underline">
          Sign up
        </button>
      </p>

      <div className="mt-8 pt-6 border-t border-[#E2DDD1]">
        <p className="text-center text-[12.5px] font-semibold text-[#8A8373] mb-3">Testing? Preview a role directly</p>
        <QuickPreviewRow busy={demoBusy} onPick={quickPreview} />
      </div>
    </AuthShell>
  )
}

// Not DemoRolePicker reused here -- that component calls
// demoSwitchRole() straight away, which needs an already-authenticated
// gateway/persona session token to even have something to switch FROM.
// Here nobody's signed in yet at all -- quickPreview does the real
// sequence (sign in with the demo credential, then switch), this is
// just the row of buttons that triggers it in one tap.
function QuickPreviewRow({ busy, onPick }: { busy: Role | null; onPick: (role: Role) => void }) {
  const roles: { role: Role; label: string }[] = [
    { role: 'student', label: 'Student' },
    { role: 'institution_staff', label: 'School / college' },
    { role: 'provider_staff', label: 'Training provider' },
    { role: 'employer', label: 'Employer' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {roles.map(r => (
        <button
          key={r.role} onClick={() => onPick(r.role)} disabled={busy !== null}
          className="text-[13px] font-semibold text-ink bg-white border border-[#E2DDD1] rounded-xl py-2.5 hover:border-brand transition disabled:opacity-50"
        >
          {busy === r.role ? 'Opening…' : r.label}
        </button>
      ))}
    </div>
  )
}
