'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getReviewQueue, submitReview, setModeration, getStudentReviewHistory } from '@/lib/supabase'
import { PrimaryButton, SecondaryButton, ErrorBanner } from '@/components/v2/Field'
import type { Submission } from '@/lib/types'
import { CheckCircle, RotateCcw, Flag, ShieldOff, Ban, Clock, History } from 'lucide-react'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: 'Awaiting review', cls: 'bg-[#FFF3E4] text-[#B3651E]' },
  returned: { label: 'Returned for revision', cls: 'bg-[#F5F1E8] text-[#8A8373]' },
  verified: { label: 'Verified', cls: 'bg-[#E9F6EC] text-[#1E7A34]' },
  revoked: { label: 'Revoked', cls: 'bg-[#FDEEEA] text-[#B3401E]' },
}

const DECISION_LABEL: Record<string, string> = { verified: 'Verified', returned: 'Returned', revoked: 'Revoked' }

function waitingSince(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${Math.max(mins, 0)}m waiting`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h waiting`
  const days = Math.floor(hours / 24)
  return `${days}d waiting`
}

export default function ReviewQueuePanel() {
  const { user } = useAuth()
  const [items, setItems] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = () => {
    if (!user?.organisation_id) return
    getReviewQueue(user.organisation_id).then(({ data }) => { setItems((data as any) || []); setLoading(false) })
  }
  useEffect(load, [user?.organisation_id])

  const pending = items.filter(i => i.status === 'submitted')
  const decided = items.filter(i => i.status !== 'submitted')

  return (
    <div>
      <p className="font-bold text-ink text-[15px] mb-5">Review queue</p>

      {loading ? (
        <p className="text-[#8A8373] text-[14px]">Loading…</p>
      ) : pending.length === 0 && decided.length === 0 ? (
        <p className="text-[#8A8373] text-[14px]">Nothing submitted yet.</p>
      ) : (
        <div className="space-y-3">
          {pending.map(s => (
            <SubmissionRow key={s.id} submission={s} open={openId === s.id} onToggle={() => setOpenId(o => o === s.id ? null : s.id)} onDecided={load} />
          ))}
          {decided.length > 0 && pending.length > 0 && <div className="h-px bg-[#EDE9E1] my-4" />}
          {decided.map(s => (
            <SubmissionRow key={s.id} submission={s} open={openId === s.id} onToggle={() => setOpenId(o => o === s.id ? null : s.id)} onDecided={load} />
          ))}
        </div>
      )}
    </div>
  )
}

function SubmissionRow({
  submission, open, onToggle, onDecided,
}: { submission: any; open: boolean; onToggle: () => void; onDecided: () => void }) {
  const { user } = useAuth()
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<any[] | null>(null)
  const status = STATUS_LABEL[submission.status] || STATUS_LABEL.submitted
  const canDecide = submission.status === 'submitted'
  const canRevoke = submission.status === 'verified'
  const isFlagged = submission.moderation_status !== 'clear'

  useEffect(() => {
    if (!open || history !== null) return
    getStudentReviewHistory(submission.student_id, submission.id).then(({ data }) => setHistory(data || []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const decide = async (decision: 'verified' | 'returned' | 'revoked') => {
    setError('')
    if (decision === 'revoked' && !feedback.trim()) return setError('A reason is required to revoke a verification.')
    if (!user) return
    setLoading(true)
    const { error: reviewError } = await submitReview(submission.id, user.id, decision, feedback.trim())
    setLoading(false)
    if (reviewError) return setError(reviewError.message)
    setFeedback('')
    onDecided()
  }

  const toggleFlag = async () => {
    await setModeration(submission.id, isFlagged ? 'clear' : 'flagged', isFlagged ? undefined : 'Flagged for review by staff')
    onDecided()
  }

  return (
    <div className="border border-[#EDE9E1] rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-[#FBF9F4] transition">
        <div className="min-w-0">
          <p className="font-semibold text-ink text-[14px] truncate">{submission.users?.full_name} — {submission.work_items?.title}</p>
          <p className="text-[12px] text-[#8A8373] flex items-center gap-2">
            <span>{new Date(submission.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {canDecide && (
              <span className="flex items-center gap-1 text-[#B3651E] font-semibold">
                <Clock className="w-3 h-3" /> {waitingSince(submission.submitted_at)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isFlagged && <Flag className="w-3.5 h-3.5 text-[#B3401E]" />}
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${status.cls}`}>{status.label}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[#EDE9E1] pt-4">
          <div className="bg-[#FBF9F4] rounded-lg p-3.5 mb-3">
            <p className="text-[12px] font-semibold text-[#8A8373] uppercase tracking-wide mb-1">Criteria</p>
            <p className="text-[13px] text-[#4A453B] mb-3">{submission.work_items?.criteria}</p>
            <p className="text-[12px] font-semibold text-[#8A8373] uppercase tracking-wide mb-1">Submitted work</p>
            <p className="text-[13px] text-[#4A453B] whitespace-pre-wrap">{submission.content}</p>
          </div>

          {history !== null && history.length > 0 && (
            <div className="mb-3">
              <p className="text-[12px] font-semibold text-[#8A8373] uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Past reviews for {submission.users?.full_name}
              </p>
              <div className="space-y-1.5">
                {history.map(h => (
                  <div key={h.id} className="text-[12px] text-[#6B6558] border-l-2 border-[#EDE9E1] pl-2.5">
                    <span className="font-semibold text-ink">{DECISION_LABEL[h.decision] || h.decision}</span>
                    {' — '}{h.submissions?.work_items?.title}
                    {' · '}{new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{h.users?.full_name}
                    {h.feedback && <span className="block italic text-[#8A8373]">"{h.feedback}"</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <ErrorBanner message={error} />

          {canDecide && (
            <>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Structured feedback tied to this submission — logged, not a private chat."
                rows={3}
                className="w-full bg-white border border-[#E2DDD1] rounded-xl px-4 py-3 text-[14px] text-ink placeholder-[#A39C8A] outline-none focus:border-brand transition mb-3 resize-none"
              />
              <div className="flex gap-2">
                <SecondaryButton onClick={() => decide('returned')} disabled={loading}>
                  <span className="flex items-center justify-center gap-1.5"><RotateCcw className="w-4 h-4" /> Return for revision</span>
                </SecondaryButton>
                <PrimaryButton onClick={() => decide('verified')} loading={loading} disabled={isFlagged}>
                  <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Verify</span>
                </PrimaryButton>
              </div>
              {isFlagged && <p className="text-[12px] text-[#B3401E] mt-2">Flagged for moderation — clear it before verifying.</p>}
            </>
          )}

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#EDE9E1]">
            <button onClick={toggleFlag} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8A8373] hover:text-ink transition">
              <ShieldOff className="w-3.5 h-3.5" /> {isFlagged ? 'Clear flag' : 'Flag for moderation'}
            </button>
            {canRevoke && (
              <div className="flex-1 flex items-center gap-2">
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Reason for revoking (required)"
                  rows={1}
                  className="flex-1 bg-white border border-[#E2DDD1] rounded-lg px-3 py-1.5 text-[12px] text-ink placeholder-[#A39C8A] outline-none focus:border-brand transition"
                />
                <button onClick={() => decide('revoked')} disabled={loading} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#B3401E] hover:underline flex-shrink-0">
                  <Ban className="w-3.5 h-3.5" /> Revoke
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
