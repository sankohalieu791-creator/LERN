'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import DashboardShell from '@/components/v2/DashboardShell'
import { PrimaryButton } from '@/components/v2/Field'
import { supabase, generateJoinCode, revokeJoinCode, listJoinCodes } from '@/lib/supabase'
import type { Organisation, JoinCode } from '@/lib/types'
import { Copy, Check, Ban } from 'lucide-react'

export default function OrgDashboard() {
  const { user } = useAuth()
  const [org, setOrg] = useState<Organisation | null>(null)
  const [codes, setCodes] = useState<JoinCode[]>([])
  const [generating, setGenerating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.organisation_id) return
    supabase.from('organisations').select('*').eq('id', user.organisation_id).single()
      .then(({ data }) => setOrg(data))
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
    <DashboardShell orgName={org?.name}>
      <h1 className="text-2xl font-bold text-ink mb-1">{org?.name || 'Your organisation'}</h1>
      <p className="text-[#6B6558] mb-10">
        {org?.safeguarding_lead_id === user?.id
          ? "You're the safeguarding lead — you'll see the review log for all your students here."
          : 'Organisation dashboard.'}
      </p>

      <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <p className="font-bold text-ink text-[15px]">Join codes</p>
          <div className="w-40">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-brand text-white font-semibold text-[13px] px-4 py-2 rounded-lg hover:bg-[#D95E17] transition disabled:opacity-40"
            >
              {generating ? 'Generating…' : 'New code'}
            </button>
          </div>
        </div>

        {codes.length === 0 ? (
          <p className="text-[#8A8373] text-[14px]">No join codes yet.</p>
        ) : (
          <div className="space-y-2">
            {codes.map(c => (
              <div key={c.id} className="flex items-center justify-between border border-[#EDE9E1] rounded-xl px-4 py-3">
                <span className={`font-mono font-bold tracking-wider text-[15px] ${c.revoked ? 'text-[#C9C2B2] line-through' : 'text-ink'}`}>
                  {c.code}
                </span>
                <div className="flex items-center gap-3">
                  {c.revoked ? (
                    <span className="text-[12px] text-[#B3401E] font-semibold">Revoked</span>
                  ) : (
                    <>
                      <button onClick={() => copy(c.code, c.id)} className="text-[#6B6558] hover:text-brand transition">
                        {copiedId === c.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleRevoke(c.id)} className="text-[#6B6558] hover:text-[#B3401E] transition">
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

      <div className="grid grid-cols-2 gap-5">
        {['Briefs & courses', 'Review queue'].map(label => (
          <div key={label} className="bg-white border border-[#E2DDD1] rounded-2xl p-6 h-32 flex items-center justify-center">
            <span className="text-[#A39C8A] font-semibold">{label} — coming next</span>
          </div>
        ))}
      </div>
    </DashboardShell>
  )
}
