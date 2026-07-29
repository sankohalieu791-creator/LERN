'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signUp, signIn, updateUserProfile } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'

const MIN_DOB = new Date(Date.now() - 120 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const MAX_DOB = new Date().toISOString().slice(0, 10)

export default function SignupPage() {
  const [username, setUsername] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [dob,      setDob]      = useState('')
  const [show,     setShow]     = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (dob > MAX_DOB || dob < MIN_DOB) { setError('Please enter a valid date of birth.'); return }
    setLoading(true)
    try {
      const { error: signUpError } = await signUp(email, password, username)
      if (signUpError) { setError(signUpError.message); return }
      // Sign in immediately so the user lands on /feed already authenticated
      const { data: signInData, error: signInError } = await signIn(email, password)
      if (signInError) { setError(signInError.message); return }
      // Only safe to write date_of_birth now — the session (and RLS's auth.uid())
      // isn't reliably hydrated immediately after signUp() itself.
      if (signInData?.user) await updateUserProfile(signInData.user.id, { date_of_birth: dob })
      router.push('/feed')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center px-6">

      <div className="mb-10 text-center">
        <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] bg-clip-text text-transparent">LERN</h1>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-center">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Username"
            required
            className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.09)] rounded-2xl px-4 py-4 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.22)] transition"
          />

          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.09)] rounded-2xl px-4 py-4 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.22)] transition"
          />

          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.09)] rounded-2xl px-4 py-4 pr-12 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.22)] transition"
            />
            <button type="button" onClick={() => setShow(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555]">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div>
            <label className="block text-[#555] text-xs font-semibold mb-1.5 ml-1">Date of birth</label>
            <input
              type="date"
              value={dob}
              min={MIN_DOB}
              max={MAX_DOB}
              onChange={e => setDob(e.target.value)}
              required
              className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.09)] rounded-2xl px-4 py-4 text-white text-sm outline-none focus:border-[rgba(255,255,255,0.22)] transition [color-scheme:dark]"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !email || !password || !dob}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 active:scale-[0.98] transition mt-2"
          >
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <p className="text-center text-[#555] text-sm pt-2">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-white font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
