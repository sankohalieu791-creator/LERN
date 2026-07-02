'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { createOrganisation, getMyOrganisation } from '@/lib/supabase'
import { Loader2, Building2, ChevronLeft, CheckCircle } from 'lucide-react'

const inputCls = 'w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition'
const labelCls = 'block text-[#888] text-[11px] font-bold uppercase tracking-wider mb-2'

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function randomCode(len = 8) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase()
}

export default function RegisterOrganisationPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [name,    setName]    = useState('')
  const [slug,    setSlug]    = useState('')
  const [code,    setCode]    = useState(randomCode())
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [done,    setDone]    = useState(false)
  const [org,     setOrg]     = useState<any>(null)

  const handleNameChange = (v: string) => {
    setName(v)
    setSlug(slugify(v))
  }

  const handleSubmit = async () => {
    if (!user) { router.push('/auth/login?redirect=/organisation/register'); return }
    if (!name.trim() || !slug.trim() || !code.trim()) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    setError('')

    const { data: existing } = await getMyOrganisation(user.id)
    if (existing) {
      setError("You're already managing an organisation.")
      setLoading(false)
      return
    }

    const { data, error: err } = await createOrganisation(user.id, {
      name:      name.trim(),
      slug:      slug.trim(),
      join_code: code.trim().toUpperCase(),
    })

    if (err) {
      const msg = err.message ?? ''
      if (msg.includes('slug'))      setError('That URL slug is already taken — try a different name.')
      else if (msg.includes('join_code') || msg.includes('unique')) setError('That join code is taken — tap Generate for a new one.')
      else setError(`Error: ${msg || 'Something went wrong. Try again.'}`)
      setLoading(false)
      return
    }

    setOrg(data)
    setDone(true)
    setLoading(false)
  }

  if (done && org) return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center px-8 gap-6"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-green-400" />
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-xl mb-1">{org.name} is live!</p>
        <p className="text-[#888] text-sm">Your institution space is ready.</p>
      </div>
      <div className="w-full max-w-xs bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 space-y-3">
        <div>
          <p className="text-[#555] text-[10px] font-bold uppercase tracking-wider mb-1">Join Code</p>
          <p className="text-white font-bold text-2xl tracking-[0.3em]">{org.join_code}</p>
        </div>
        <div>
          <p className="text-[#555] text-[10px] font-bold uppercase tracking-wider mb-1">Invite Link</p>
          <p className="text-[#888] text-xs break-all">
            {typeof window !== 'undefined' ? window.location.origin : ''}/join/{org.slug}
          </p>
        </div>
      </div>
      <p className="text-[#555] text-xs text-center">
        Share the join code or invite link with your students to give them access to your private courses.
      </p>
      <button
        onClick={() => router.push('/organisation')}
        className="w-full max-w-xs bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl"
      >
        Go to Dashboard
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
        <button onClick={() => router.back()}
          className="w-9 h-9 bg-[#1a1a1a] rounded-full flex items-center justify-center flex-shrink-0">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white font-bold text-base">Register Your Institution</h1>
      </div>

      {/* Scrollable content — button lives inside here so keyboard never hides it */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center flex-shrink-0">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">Set up your institution</p>
            <p className="text-[#555] text-xs mt-0.5 leading-relaxed">
              Students join with a code or invite link and get access to your private courses.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>Institution Name</label>
            <input
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. City College London"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>URL Slug</label>
            <div className="flex items-center bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 gap-1">
              <span className="text-[#555] text-sm whitespace-nowrap">lern.app/join/</span>
              <input
                value={slug}
                onChange={e => setSlug(slugify(e.target.value))}
                placeholder="city-college-london"
                className="flex-1 bg-transparent text-white text-sm placeholder-[#444] outline-none min-w-0"
              />
            </div>
            <p className="text-[#444] text-xs mt-1.5 px-1">Invite link students tap to join instantly.</p>
          </div>

          <div>
            <label className={labelCls}>Join Code</label>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="e.g. CITY2024"
                maxLength={12}
                className={`${inputCls} font-bold tracking-[0.2em] flex-1`}
              />
              <button
                type="button"
                onClick={() => setCode(randomCode())}
                className="px-4 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-2xl text-[#888] text-xs font-semibold whitespace-nowrap hover:text-white transition"
              >
                Generate
              </button>
            </div>
            <p className="text-[#444] text-xs mt-1.5 px-1">Students can type this at lern.app/join.</p>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 rounded-xl px-4 py-3">{error}</p>
        )}

        {/* Button inside scroll area — never hidden by keyboard */}
        <div className="pt-2 pb-10" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim() || !slug.trim() || !code.trim()}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
              : 'Create Institution Space'
            }
          </button>
        </div>
      </div>

    </div>
  )
}
