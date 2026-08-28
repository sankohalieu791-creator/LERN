'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { generateJoinCode, revokeJoinCode, listJoinCodes } from '@/lib/supabase'
import type { JoinCode } from '@/lib/types'
import { Copy, Check, Ban } from 'lucide-react'

export default function JoinCodesPanel() {
  const { user } = useAuth()
  const [codes, setCodes] = useState<JoinCode[]>([])
  const [generating, setGenerating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.organisation_id) return
    listJoinCodes(user.organisation_id).then(({ data }) => setCodes(data || []))
  }, [user?.organisation_id])

  const handleGenerate = async () => {
    if (!user?.organisation_id) return
    setGenerating(true)
    const { data } = await generateJoinCode(user.organisation_id, user.id, null)
    setGenerating(false)
    if (data) setCodes(prev => [data as JoinCode, ...prev])
  }

  const handleRevoke = async (id: string) => {
    await revokeJoinCode(id)
    setCodes(prev => prev.map(c => c.id === id ? { ...c, revoked: true } : c))
  }

  const copy = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="font-bold text-ink text-[15px]">Join codes</p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-brand text-white font-semibold text-[13px] px-4 py-2 rounded-lg hover:bg-brand-hover transition disabled:opacity-40"
        >
          {generating ? 'Generating…' : 'New code'}
        </button>
      </div>

      {codes.length === 0 ? (
        <p className="text-ink-tertiary text-[14px]">No join codes yet.</p>
      ) : (
        <div className="space-y-2">
          {codes.map(c => (
            <div key={c.id} className="flex items-center justify-between border border-edge-subtle rounded-xl px-4 py-3">
              <span className={`font-mono font-bold tracking-wider text-[15px] ${c.revoked ? 'text-edge-input line-through' : 'text-ink'}`}>
                {c.code}
              </span>
              <div className="flex items-center gap-3">
                {c.revoked ? (
                  <span className="text-[12px] text-danger-text font-semibold">Revoked</span>
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
          ))}
        </div>
      )}
    </div>
  )
}
