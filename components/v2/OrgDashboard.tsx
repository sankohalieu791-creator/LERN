'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import DashboardShell from '@/components/v2/DashboardShell'
import { supabase, generateJoinCode, revokeJoinCode, listJoinCodes } from '@/lib/supabase'
import type { Organisation, JoinCode } from '@/lib/types'
import BriefsPanel from '@/components/v2/BriefsPanel'
import ReviewQueuePanel from '@/components/v2/ReviewQueuePanel'
import { Copy, Check, Ban } from 'lucide-react'

type Tab = 'review' | 'briefs' | 'codes'

export default function OrgDashboard() {
  const { user } = useAuth()
  const [org, setOrg] = useState<Organisation | null>(null)
  const [tab, setTab] = useState<Tab>('review')

  useEffect(() => {
    if (!user?.organisation_id) return
    supabase.from('organisations').select('*').eq('id', user.organisation_id).single()
      .then(({ data }) => setOrg(data))
  }, [user?.organisation_id])

  return (
    <DashboardShell orgName={org?.name}>
      <h1 className="text-2xl font-bold text-ink mb-1">{org?.name || 'Your organisation'}</h1>
      <p className="text-[#6B6558] mb-8">
        {org?.safeguarding_lead_id === user?.id
          ? "You're the safeguarding lead — every review here is logged and visible to you."
          : 'Organisation dashboard.'}
      </p>

      <div className="flex gap-1 mb-6 border-b border-[#EDE9E1]">
        {([['review', 'Review queue'], ['briefs', 'Briefs & courses'], ['codes', 'Join codes']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-[14px] font-semibold border-b-2 -mb-px transition ${
              tab === key ? 'text-ink border-brand' : 'text-[#8A8373] border-transparent hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6">
        {tab === 'review' && <ReviewQueuePanel />}
        {tab === 'briefs' && <BriefsPanel />}
        {tab === 'codes' && <JoinCodesPanel organisationId={org?.id} />}
      </div>
    </DashboardShell>
  )
}

function JoinCodesPanel({ organisationId }: { organisationId?: string }) {
  const { user } = useAuth()
  const [codes, setCodes] = useState<JoinCode[]>([])
  const [generating, setGenerating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!organisationId) return
    listJoinCodes(organisationId).then(({ data }) => setCodes(data || []))
  }, [organisationId])

  const handleGenerate = async () => {
    if (!organisationId || !user) return
    setGenerating(true)
    const { data } = await generateJoinCode(organisationId, user.id, null)
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
          className="bg-brand text-white font-semibold text-[13px] px-4 py-2 rounded-lg hover:bg-[#D95E17] transition disabled:opacity-40"
        >
          {generating ? 'Generating…' : 'New code'}
        </button>
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
  )
}
