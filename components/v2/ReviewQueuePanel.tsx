'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getReviewQueue, submitReview, setModeration, getStudentReviewHistory, getSignedFileUrl } from '@/lib/supabase'
import { PrimaryButton, SecondaryButton, ErrorBanner } from '@/components/v2/Field'
import type { Submission } from '@/lib/types'
import { CheckCircle, RotateCcw, Flag, ShieldOff, Ban, Clock, History, FileText, ExternalLink, PartyPopper, ClipboardList } from 'lucide-react'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: 'Awaiting review', cls: 'bg-warning-bg text-warning-text' },
  returned: { label: 'Returned for revision', cls: 'bg-surface-muted text-ink-tertiary' },
  verified: { label: 'Verified', cls: 'bg-success-bg text-success-text' },
  revoked: { label: 'Revoked', cls: 'bg-danger-bg text-danger-text' },
}

const DECISION_LABEL: Record<string, string> = { verified: 'Verified', returned: 'Returned', revoked: 'Revoked' }

function waitingInfo(dateStr: string): { label: string; cls: string } {
  const ms = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const mins = Math.floor(ms / 60000)
  const label = hours < 1 ? `${Math.max(mins, 0)}m waiting` : hours < 24 ? `${hours}h waiting` : `${Math.floor(hours / 24)}d waiting`
  const cls = hours >= 48 ? 'text-danger-text' : hours >= 24 ? 'text-warning-text' : 'text-ink-tertiary'
  return { label, cls }
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

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
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <p className="font-bold text-ink text-[15px]">Review queue</p>
        {!loading && (
          <span className={`flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full ${
            pending.length > 0 ? 'bg-warning-bg text-warning-text' : 'bg-success-bg text-success-text'
          }`}>
            <ClipboardList className="w-3.5 h-3.5" />
            {pending.length > 0 ? `${pending.length} work item${pending.length === 1 ? '' : 's'} left to review` : 'All caught up'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-surface-muted animate-pulse" />)}
        </div>
      ) : pending.length === 0 && decided.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {pending.length === 0 ? (
            <AllCaughtUp />
          ) : (
            pending.map(s => (
              <SubmissionRow key={s.id} submission={s} open={openId === s.id} onToggle={() => setOpenId(o => o === s.id ? null : s.id)} onDecided={load} />
            ))
          )}
          {decided.length > 0 && (
            <>
              <div className="h-px bg-edge-subtle my-4" />
              <p className="text-[12px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1">Already decided</p>
              {decided.map(s => (
                <SubmissionRow key={s.id} submission={s} open={openId === s.id} onToggle={() => setOpenId(o => o === s.id ? null : s.id)} onDecided={load} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center text-center py-14">
      <div className="w-12 h-12 rounded-full bg-surface-muted flex items-center justify-center mb-3">
        <FileText className="w-5 h-5 text-ink-quaternary" />
      </div>
      <p className="font-semibold text-ink text-[14px] mb-1">Nothing submitted yet</p>
      <p className="text-[13px] text-ink-tertiary">Work will land here once students start submitting against your briefs.</p>
    </div>
  )
}

function AllCaughtUp() {
  return (
    <div className="flex flex-col items-center text-center py-14 mb-2">
      <div className="w-12 h-12 rounded-full bg-success-bg flex items-center justify-center mb-3">
        <CheckCircle className="w-5 h-5 text-success-text" />
      </div>
      <p className="font-semibold text-ink text-[14px] mb-1">All caught up</p>
      <p className="text-[13px] text-ink-tertiary">Nothing waiting for review right now.</p>
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
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [justVerified, setJustVerified] = useState(false)
  const status = STATUS_LABEL[submission.status] || STATUS_LABEL.submitted
  const canDecide = submission.status === 'submitted'
  const canRevoke = submission.status === 'verified'
  const isFlagged = submission.moderation_status !== 'clear'
  const waiting = canDecide ? waitingInfo(submission.submitted_at) : null

  useEffect(() => {
    if (!open) return
    if (history === null) getStudentReviewHistory(submission.student_id, submission.id).then(({ data }) => setHistory(data || []))
    if (submission.file_path && fileUrl === null) getSignedFileUrl('submission-files', submission.file_path).then(({ url }) => setFileUrl(url))
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
    if (decision === 'verified') {
      setJustVerified(true)
      setTimeout(() => { setJustVerified(false); onDecided() }, 1100)
    } else {
      onDecided()
    }
  }

  const toggleFlag = async () => {
    await setModeration(submission.id, isFlagged ? 'clear' : 'flagged', isFlagged ? undefined : 'Flagged for review by staff')
    onDecided()
  }

  const isImage = submission.file_type && IMAGE_TYPES.includes(submission.file_type)

  return (
    <div className="border border-edge-subtle rounded-xl overflow-hidden relative">
      {justVerified && (
        <div className="absolute inset-0 z-10 bg-surface/95 flex flex-col items-center justify-center gap-2 animate-fadeIn">
          <div className="w-11 h-11 rounded-full bg-success-bg flex items-center justify-center">
            <PartyPopper className="w-5 h-5 text-success-text" />
          </div>
          <p className="font-bold text-success-text text-[14px]">Verified — on {submission.users?.full_name}'s profile</p>
        </div>
      )}

      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-surface-subtle transition">
        <div className="min-w-0">
          <p className="font-semibold text-ink text-[14px] truncate">{submission.users?.full_name} — {submission.work_items?.title}</p>
          <p className="text-[12px] text-ink-tertiary flex items-center gap-2">
            <span>{new Date(submission.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {waiting && (
              <span className={`flex items-center gap-1 font-semibold ${waiting.cls}`}>
                <Clock className="w-3 h-3" /> {waiting.label}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isFlagged && <Flag className="w-3.5 h-3.5 text-danger-text" />}
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${status.cls}`}>{status.label}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-edge-subtle pt-5">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-surface-subtle rounded-xl p-4">
              <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1.5">Success criteria</p>
              <p className="text-[13.5px] text-ink-body leading-relaxed">{submission.work_items?.criteria}</p>
            </div>
            <div className="bg-surface-subtle rounded-xl p-4">
              <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1.5">Submitted work</p>
              {isImage && fileUrl ? (
                <img src={fileUrl} alt="Submitted work" className="max-h-56 w-auto rounded-lg border border-edge mb-2" />
              ) : submission.file_path ? (
                <a
                  href={fileUrl || '#'} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] font-semibold text-ink hover:border-brand transition mb-2"
                >
                  <FileText className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
                  <span className="truncate flex-1">{submission.file_path.split('/').pop()}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-ink-tertiary flex-shrink-0" />
                </a>
              ) : null}
              {submission.content && <p className="text-[13.5px] text-ink-body whitespace-pre-wrap leading-relaxed">{submission.content}</p>}
              {!submission.content && !submission.file_path && <p className="text-[13px] text-ink-quaternary italic">Nothing attached.</p>}
            </div>
          </div>

          {history !== null && history.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Past reviews for {submission.users?.full_name}
              </p>
              <div className="space-y-1.5">
                {history.map(h => (
                  <div key={h.id} className="text-[12px] text-ink-secondary border-l-2 border-edge-subtle pl-2.5">
                    <span className="font-semibold text-ink">{DECISION_LABEL[h.decision] || h.decision}</span>
                    {' — '}{h.submissions?.work_items?.title}
                    {' · '}{new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{h.users?.full_name}
                    {h.feedback && <span className="block italic text-ink-tertiary">"{h.feedback}"</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <ErrorBanner message={error} />

          {canDecide && (
            <>
              <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1.5">Your feedback</p>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Check the work against the criteria above, then write your feedback here — logged against this submission, never a private chat."
                rows={4}
                className="w-full bg-surface border border-edge rounded-xl px-4 py-3.5 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition mb-3.5 resize-none leading-relaxed"
              />
              <div className="flex gap-2.5">
                <SecondaryButton onClick={() => decide('returned')} disabled={loading}>
                  <span className="flex items-center justify-center gap-1.5"><RotateCcw className="w-4 h-4" /> Return for revision</span>
                </SecondaryButton>
                <PrimaryButton onClick={() => decide('verified')} loading={loading} disabled={isFlagged}>
                  <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Verify</span>
                </PrimaryButton>
              </div>
              {isFlagged && <p className="text-[12px] text-danger-text mt-2">Flagged for moderation — clear it before verifying.</p>}
            </>
          )}

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-edge-subtle">
            <button onClick={toggleFlag} className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-tertiary hover:text-ink transition">
              <ShieldOff className="w-3.5 h-3.5" /> {isFlagged ? 'Clear flag' : 'Flag for moderation'}
            </button>
            {canRevoke && (
              <div className="flex-1 flex items-center gap-2">
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Reason for revoking (required)"
                  rows={1}
                  className="flex-1 bg-surface border border-edge rounded-lg px-3 py-1.5 text-[12px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
                />
                <button onClick={() => decide('revoked')} disabled={loading} className="flex items-center gap-1.5 text-[12px] font-semibold text-danger-text hover:underline flex-shrink-0">
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
