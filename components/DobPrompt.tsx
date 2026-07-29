'use client'

import { useState } from 'react'
import { Cake } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { updateUserProfile } from '@/lib/supabase'

const MIN_DOB = new Date(Date.now() - 120 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const MAX_DOB = new Date().toISOString().slice(0, 10)

export default function DobPrompt() {
  const { user, refreshUser } = useAuth() as any
  const [dob, setDob] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Only shows once the safety gate is cleared, and only when date_of_birth is missing.
  if (!user || !user.terms_accepted_at || user.date_of_birth) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (dob > MAX_DOB || dob < MIN_DOB) { setError('Please enter a valid date of birth.'); return }
    setError('')
    setBusy(true)
    await updateUserProfile(user.id, { date_of_birth: dob })
    await refreshUser()
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[10000] px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm bg-[#141414] rounded-3xl p-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center mb-4">
          <Cake className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-white text-xl font-black mb-1.5">One quick thing</h2>
        <p className="text-[#888] text-sm mb-5 leading-relaxed">
          We need your date of birth to keep the platform age-appropriate and safe — for example, making sure only adults can be contacted directly by employers.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="date"
            value={dob}
            min={MIN_DOB}
            max={MAX_DOB}
            onChange={e => setDob(e.target.value)}
            required
            className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.09)] rounded-2xl px-4 py-4 text-white text-sm outline-none focus:border-[rgba(255,255,255,0.22)] transition [color-scheme:dark]"
          />
          {error && <p className="text-red-400 text-xs px-1">{error}</p>}
          <button
            type="submit"
            disabled={busy || !dob}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 active:scale-[0.98] transition"
          >
            {busy ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
