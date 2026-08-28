'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { generateJoinCode, revokeJoinCode, listJoinCodes } from '@/lib/supabase'
import type { JoinCode } from '@/lib/types'
import { ErrorBanner } from '@/components/v2/Field'
import { Copy, Check, Ban } from 'lucide-react'

const CODE_PATTERN = /^[A-Z0-9]{4,6}$/

export default function JoinCodesPanel() {
  const { user } = useAuth()
  const [codes, setCodes] = useState<JoinCode[]>([])
  const [newCode, setNewCode] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    if (!user?.organisation_id) return
    listJoinCodes(user.organisation_id).then(({ data, error: err }) => {
      if (err) return setError(err.message)
      setCodes(data || [])
    })
  }
  useEffect(load, [user?.organisation_id])

  const handleGenerate = async () => {
    setError('')
    if (!user?.organisation_id) { setError('No organisation found on your account — try signing out and back in.'); return }
    const code = newCode.trim().toUpperCase()
    if (!CODE_PATTERN.test(code)) { setError('Codes are 4–6 letters or numbers.'); return }
    setGenerating(true)
    const { data, error: err } = await generateJoinCode(user.organisation_id, user.id, code)
    setGenerating(false)
    if (err) return setError(err.message)
    if (data) { setCodes(prev => [data as JoinCode, ...prev]); setNewCode('') }
  }

  const handleRevoke = async (id: string) => {
    setError('')
    const { error: err } = await revokeJoinCode(id)
    if (err) return setError(err.message)
    setCodes(prev => prev.map(c => c.id === id ? { ...c, revoked: true } : c))
  }

  const copy = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div>
      <ErrorBanner message={error} />
      <p className="font-bold text-ink text-[15px] mb-1.5">Join codes</p>
      <p className="text-[13px] text-ink-tertiary mb-4">Pick your own code — 4 to 6 letters or numbers. It stays active for 2 weeks, then you'll need a new one.</p>

      <div className="flex gap-2 mb-5">
        <input
          value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase().slice(0, 6))}
          onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          placeholder="e.g. YR12A" maxLength={6}
          className="w-40 bg-surface border border-edge rounded-lg px-3.5 py-2 font-mono font-bold tracking-wider text-[15px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
        />
        <button
          onClick={handleGenerate}
          disabled={generating || !newCode.trim()}
          className="bg-brand text-white font-semibold text-[13px] px-4 py-2 rounded-lg hover:bg-brand-hover transition disabled:opacity-40"
        >
          {generating ? 'Creating…' : 'Create code'}
        </button>
      </div>

      {codes.length === 0 ? (
        <p className="text-ink-tertiary text-[14px]">No join codes yet.</p>
      ) : (
        <div className="space-y-2">
          {codes.map(c => {
            const expired = !!c.expires_at && new Date(c.expires_at) < new Date()
            return (
              <div key={c.id} className="flex items-center justify-between border border-edge-subtle rounded-xl px-4 py-3">
                <div>
                  <span className={`font-mono font-bold tracking-wider text-[15px] ${c.revoked || expired ? 'text-edge-input line-through' : 'text-ink'}`}>
                    {c.code}
                  </span>
                  {!c.revoked && c.expires_at && (
                    <span className="block text-[11px] text-ink-tertiary mt-0.5">
                      {expired ? 'Expired' : `Expires ${new Date(c.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {c.revoked ? (
                    <span className="text-[12px] text-danger-text font-semibold">Revoked</span>
                  ) : expired ? (
                    <span className="text-[12px] text-ink-tertiary font-semibold">Expired</span>
                  ) : (
                    <>
                      <button onClick={() => copy(c.code, c.id)} className="text-ink-secondary hover:text-brand transition">
                        {copiedId === c.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleRevoke(c.id)} className="text-ink-secondary hover:text-danger-text transition">
                        <Ban className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
