'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getVisibleWorkItems, getMySubmissions, submitWork, setShareVisibility } from '@/lib/supabase'
import { PrimaryButton, SecondaryButton, ErrorBanner } from '@/components/v2/Field'
import type { WorkItem, Submission } from '@/lib/types'
import { CheckCircle2, Clock, RotateCcw, Ban, Globe, Users } from 'lucide-react'

const STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  submitted: { label: 'Awaiting review', cls: 'bg-[#FFF3E4] text-[#B3651E]', icon: Clock },
  returned: { label: 'Returned — resubmit below', cls: 'bg-[#F5F1E8] text-[#8A8373]', icon: RotateCcw },
  verified: { label: 'Verified', cls: 'bg-[#E9F6EC] text-[#1E7A34]', icon: CheckCircle2 },
  revoked: { label: 'Revoked', cls: 'bg-[#FDEEEA] text-[#B3401E]', icon: Ban },
}

function isAdult(dob?: string): boolean {
  if (!dob) return false
  const age = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  return age >= 18
}

export default function MyWorkPanel() {
  const { user } = useAuth()
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openWorkItemId, setOpenWorkItemId] = useState<string | null>(null)

  const load = () => {
    if (!user?.organisation_id) return
    Promise.all([
      getVisibleWorkItems(user.organisation_id),
      getMySubmissions(user.id),
    ]).then(([wi, subs]) => {
      setWorkItems(wi.data || [])
      setSubmissions(subs.data || [])
      setLoading(false)
    })
  }
  useEffect(load, [user?.organisation_id, user?.id])

  if (loading) return <p className="text-[#8A8373] text-[14px]">Loading…</p>

  return (
    <div className="space-y-3">
      {workItems.length === 0 && <p className="text-[#8A8373] text-[14px]">Nothing set for you yet — check back once your organisation posts a brief or course.</p>}
      {workItems.map(item => {
        const mySubs = submissions.filter(s => s.work_item_id === item.id)
        const latest = mySubs[0]
        return (
          <WorkItemCard
            key={item.id} item={item} latest={latest} allSubs={mySubs}
            open={openWorkItemId === item.id}
            onToggle={() => setOpenWorkItemId(o => o === item.id ? null : item.id)}
            onSubmitted={load}
          />
        )
      })}
    </div>
  )
}

function WorkItemCard({
  item, latest, allSubs, open, onToggle, onSubmitted,
}: { item: WorkItem; latest: any; allSubs: any[]; open: boolean; onToggle: () => void; onSubmitted: () => void }) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const status = latest ? STATUS[latest.status] : null
  const canSubmit = !latest || latest.status === 'returned'
  const StatusIcon = status?.icon

  const handleSubmit = async () => {
    setError('')
    if (!content.trim()) return setError('Write or link your work before submitting.')
    if (!user) return
    setLoading(true)
    const { error: submitError } = await submitWork(user.id, item.id, content.trim())
    setLoading(false)
    if (submitError) return setError(submitError.message)
    setContent('')
    onSubmitted()
  }

  return (
    <div className="border border-[#EDE9E1] rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-[#FBF9F4] transition">
        <div className="min-w-0">
          <p className="font-semibold text-ink text-[14px] truncate">{item.title}</p>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8373]">{item.type}</span>
        </div>
        {status && StatusIcon && (
          <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${status.cls}`}>
            <StatusIcon className="w-3 h-3" /> {status.label}
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[#EDE9E1] pt-4">
          <p className="text-[12px] font-semibold text-[#8A8373] uppercase tracking-wide mb-1">Criteria</p>
          <p className="text-[13px] text-[#4A453B] mb-4">{item.criteria}</p>

          {allSubs.length > 0 && (
            <div className="space-y-2 mb-4">
              {allSubs.map((s: any) => <SubmissionHistoryRow key={s.id} submission={s} />)}
            </div>
          )}

          {canSubmit && (
            <>
              <ErrorBanner message={error} />
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Paste a link, or write your work here."
                rows={4}
                className="w-full bg-white border border-[#E2DDD1] rounded-xl px-4 py-3 text-[14px] text-ink placeholder-[#A39C8A] outline-none focus:border-brand transition mb-3 resize-none"
              />
              <PrimaryButton onClick={handleSubmit} loading={loading}>
                {latest?.status === 'returned' ? 'Resubmit' : 'Submit work'}
              </PrimaryButton>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SubmissionHistoryRow({ submission }: { submission: any }) {
  const { user } = useAuth()
  const status = STATUS[submission.status]
  const verification = (submission.verifications || []).find((v: any) => !v.revoked_at) || submission.verifications?.[0]
  const adult = isAdult(user?.date_of_birth)
  const [busy, setBusy] = useState(false)

  const toggleVisibility = async () => {
    if (!verification || submission.status !== 'verified') return
    setBusy(true)
    await setShareVisibility(verification.id, verification.visibility === 'public' ? 'organisation' : 'public')
    setBusy(false)
    window.location.reload() // simplest way to reflect the new visibility right now
  }

  return (
    <div className="bg-[#FBF9F4] rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
        <span className="text-[11px] text-[#8A8373]">{new Date(submission.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
      </div>
      <p className="text-[13px] text-[#4A453B] whitespace-pre-wrap mb-1">{submission.content}</p>

      {submission.status === 'verified' && verification && !verification.revoked_at && (
        <div className="mt-2 pt-2 border-t border-[#EDE9E1] flex items-center justify-between">
          <span className="text-[11px] text-[#8A8373]">
            Verified {new Date(verification.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {adult ? (
            <button onClick={toggleVisibility} disabled={busy} className="flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
              {verification.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Users className="w-3 h-3" />}
              {verification.visibility === 'public' ? 'Public — tap to make org-only' : 'Org only — tap to make public'}
            </button>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-[#8A8373]">
              <Users className="w-3 h-3" /> Visible to your organisation only
            </span>
          )}
        </div>
      )}

      {submission.status === 'revoked' && verification?.revocation_reason && (
        <p className="text-[12px] text-[#B3401E] mt-1">Revoked: {verification.revocation_reason}</p>
      )}
    </div>
  )
}
