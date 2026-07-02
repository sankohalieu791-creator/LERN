'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getOrgByCode, joinOrganisation, supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, Building2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function JoinByCodePage() {
  const { user } = useAuth()
  const router = useRouter()

  const [code,    setCode]    = useState('')
  const [finding, setFinding] = useState(false)
  const [org,     setOrg]     = useState<any>(null)
  const [joining, setJoining] = useState(false)
  const [joined,  setJoined]  = useState(false)
  const [error,   setError]   = useState('')

  const handleFind = async () => {
    if (!code.trim()) return
    setFinding(true)
    setError('')
    setOrg(null)
    const { data } = await getOrgByCode(code.trim())
    if (!data) {
      setError('No institution found with that code. Check and try again.')
    } else {
      // Check if already a member
      if (user) {
        const { data: existing } = await supabase
          .from('organisation_members')
          .select('id')
          .eq('organisation_id', data.id)
          .eq('user_id', user.id)
          .maybeSingle()
        if (existing) { setError('You are already a member of this institution.'); setFinding(false); return }
      }
      setOrg(data)
    }
    setFinding(false)
  }

  const handleJoin = async () => {
    if (!user) { router.push('/auth/login?redirect=/join'); return }
    if (!org) return
    setJoining(true)
    const { error: err } = await joinOrganisation(user.id, org.id)
    if (err) setError('Something went wrong. Try again.')
    else setJoined(true)
    setJoining(false)
  }

  if (joined) return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center px-8 gap-5"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-green-400" />
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-xl mb-1">You&apos;ve joined!</p>
        <p className="text-[#888] text-sm">{org?.name}</p>
      </div>
      <p className="text-[#555] text-sm text-center">
        Your institution&apos;s private courses now appear in your course list.
      </p>
      <button onClick={() => router.push('/courses')}
        className="w-full max-w-xs bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl">
        View Courses
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-[#0a0a0a]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
        <button onClick={() => router.back()}
          className="w-9 h-9 bg-[#1a1a1a] rounded-full flex items-center justify-center flex-shrink-0">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white font-bold text-base">Join Institution</h1>
      </div>

      <div className="px-5 pt-8 pb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center mb-6">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-white font-bold text-2xl mb-2">Enter your institution code</h2>
        <p className="text-[#555] text-sm mb-8 leading-relaxed">
          Your institution admin will give you this code. It looks like <span className="text-white font-semibold">LEYTON24</span>.
        </p>

        <div className="space-y-4">
          <input
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setOrg(null); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleFind()}
            placeholder="Enter code e.g. LEYTON24"
            className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-2xl px-5 py-4 text-white text-lg font-bold tracking-widest placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.25)] transition uppercase"
          />

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 rounded-xl px-4 py-2">{error}</p>
          )}

          {/* Found org confirmation card */}
          {org && !error && (
            <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 flex items-center gap-3">
              {org.logo_url
                ? <img src={org.logo_url} alt={org.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{org.name}</p>
                <p className="text-[#555] text-xs">Institution found ✓</p>
              </div>
            </div>
          )}

          {!org ? (
            <button
              onClick={handleFind}
              disabled={finding || !code.trim()}
              className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {finding ? <><Loader2 className="w-4 h-4 animate-spin" /> Finding…</> : 'Find Institution'}
            </button>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {joining ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</> : `Join ${org.name}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
