'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getReviewQueue, submitReview, getStudentReviewHistory, getSignedFileUrl } from '@/lib/supabase'
import type { Submission } from '@/lib/types'
import {
  CheckCircle2, History, FileText, ExternalLink, ChevronLeft, Sparkles,
} from 'lucide-react'

// Build Spec: Review Surface (institutions and providers) v1.0. One
// surface for both org types, queue then a separate "reviewing a
// piece" screen with the work and criteria side by side. Structural
// colours (cards, page) stay this app's own theme tokens (bg-surface/
// text-ink/border-edge) rather than the spec's literal hex -- this
// screen already lives inside OrgShell, which has real working
// light/dark via data-theme, so tokens are what actually DELIVERS
// "dark and light theme... working", not a hardcoded copy of one
// side's colours. Every PINNED accent (New/Overdue pills, the green
// Verify button) is the spec's exact hex regardless of theme, same
// rule used everywhere else this session.
function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 60) return `${Math.max(mins, 0)}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
// "Overdue" if submitted past the work item's deadline, or has waited
// 48h+ regardless -- the spec names both conditions ("past the
// deadline... or has waited too long") without pinning the second
// number, so this reuses the 48h threshold the old queue already used
// for its own waiting-too-long styling, rather than inventing a new one.
function isOverdue(s: any) {
  const deadline = s.work_items?.deadline
  if (deadline && new Date(s.submitted_at) > new Date(deadline)) return true
  return Date.now() - new Date(s.submitted_at).getTime() > 48 * 60 * 60 * 1000
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

  const pending = (items.filter(i => i.status === 'submitted') as any[])
    .sort((a, b) => {
      const ao = isOverdue(a), bo = isOverdue(b)
      if (ao !== bo) return ao ? -1 : 1
      return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    })
  const openItem = pending.find(i => i.id === openId) || null

  return (
    // No max-w/mx-auto here -- main already has no width cap of its own
    // (Dashboard etc. already fill it edge-to-edge), so capping this
    // one screen just left dead margins either side of it, the
    // opposite of what was wanted: fill the pane, like Gmail/Outlook's
    // own web layouts do, not a narrow centred column floating in it.
    <div>
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setOpenId(null)}
          className={`px-4 py-2 rounded-lg text-[13px] font-semibold border transition ${!openItem ? 'border-ink bg-surface text-ink' : 'border-edge text-ink-tertiary hover:text-ink'}`}
        >
          Review queue
        </button>
        <button
          disabled={!openItem}
          className={`px-4 py-2 rounded-lg text-[13px] font-semibold border transition disabled:opacity-40 disabled:cursor-not-allowed ${openItem ? 'border-ink bg-surface text-ink' : 'border-edge text-ink-tertiary'}`}
        >
          Reviewing a piece
        </button>
      </div>

      {openItem ? (
        <ReviewPiece submission={openItem} onBack={() => setOpenId(null)} onDecided={() => { setOpenId(null); load() }} />
      ) : (
        <ReviewQueue items={pending} loading={loading} onOpen={setOpenId} />
      )}
    </div>
  )
}

function ReviewQueue({ items, loading, onOpen }: { items: any[]; loading: boolean; onOpen: (id: string) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[17px] font-semibold text-ink">Review</p>
          <p className="text-[13px]" style={{ color: '#5A5A5A' }}>Work your students have submitted</p>
        </div>
        {!loading && (
          <span className="text-[13px] font-medium px-[10px] py-[5px] rounded-full flex-shrink-0" style={{ backgroundColor: '#FAEEDA', color: '#854F0B' }}>
            {items.length} waiting
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-surface-muted animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: '#E1F5EE' }}>
            <CheckCircle2 className="w-5 h-5" style={{ color: '#0F6E56' }} />
          </div>
          <p className="font-semibold text-ink text-[14px] mb-1">Nothing waiting. You are all caught up.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {items.map(s => {
              const overdue = isOverdue(s)
              return (
                <button
                  key={s.id} onClick={() => onOpen(s.id)}
                  className="w-full flex items-center gap-3 bg-surface border border-edge rounded-xl px-4 py-[14px] text-left hover:border-edge-input transition"
                >
                  <span className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-[13px] font-medium flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
                    {initials(s.users?.full_name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-ink truncate">{s.users?.full_name}</p>
                    <p className="text-[13px] truncate" style={{ color: '#5A5A5A' }}>{s.work_items?.title}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="inline-block text-[12px] font-medium px-[10px] py-[3px] rounded-full" style={overdue ? { backgroundColor: '#FAEEDA', color: '#854F0B' } : { backgroundColor: '#E6F1FB', color: '#185FA5' }}>
                      {overdue ? 'Overdue' : 'New'}
                    </span>
                    <p className="text-[12px] mt-1" style={{ color: '#8A8A8A' }}>{timeAgo(s.submitted_at)}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-center text-[12px] mt-5" style={{ color: '#8A8A8A' }}>Verified work moves to the student's profile automatically</p>
        </>
      )}
    </div>
  )
}

function ReviewPiece({ submission, onBack, onDecided }: { submission: any; onBack: () => void; onDecided: () => void }) {
  const { user } = useAuth()
  const [ticked, setTicked] = useState<Set<number>>(new Set())
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmVerify, setConfirmVerify] = useState(false)
  const [justVerified, setJustVerified] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [history, setHistory] = useState<any[] | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (submission.file_path) getSignedFileUrl('submission-files', submission.file_path).then(({ url }) => setFileUrl(url))
    getStudentReviewHistory(submission.student_id, submission.id).then(({ data }) => setHistory(data || []))
    setTicked(new Set()); setFeedback(''); setError(''); setConfirmVerify(false)
  }, [submission.id])

  // No criteria array in the schema -- criteria is one text field a
  // tutor writes freehand. Splitting it into lines is what turns that
  // into a real tickable checklist without inventing structured data
  // that was never actually captured; a single-line criteria still
  // works fine as a one-item checklist.
  const criteriaLines = (submission.work_items?.criteria || '').split('\n').map((l: string) => l.trim()).filter(Boolean)
  const isImage = submission.file_type && ['image/png', 'image/jpeg', 'image/webp'].includes(submission.file_type)

  const toggle = (i: number) => setTicked(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })

  const verify = async () => {
    if (criteriaLines.length > 0 && ticked.size < criteriaLines.length && !confirmVerify) { setConfirmVerify(true); return }
    setConfirmVerify(false)
    await decide('verified')
  }

  const returnForChanges = async () => {
    if (!feedback.trim()) return setError('Feedback is required when returning work — say what needs to change.')
    await decide('returned')
  }

  const decide = async (decision: 'verified' | 'returned') => {
    if (!user) return
    setError(''); setLoading(true)
    const { error: reviewError } = await submitReview(submission.id, user.id, decision, feedback.trim())
    setLoading(false)
    if (reviewError) return setError(reviewError.message)
    if (decision === 'verified') { setJustVerified(true); setTimeout(onDecided, 1100) }
    else onDecided()
  }

  if (justVerified) {
    return (
      <div className="flex flex-col items-center text-center py-20">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: '#E1F5EE' }}>
          <Sparkles className="w-6 h-6" style={{ color: '#0F6E56' }} />
        </div>
        <p className="font-semibold text-[15px]" style={{ color: '#0F6E56' }}>Verified — on {submission.users?.full_name}'s profile</p>
      </div>
    )
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-[14px] font-semibold mb-4" style={{ color: '#D4551A' }}>
        <ChevronLeft className="w-4 h-4" /> Back to queue
      </button>

      <div className="flex items-center gap-3 mb-5">
        <span className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-medium flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
          {initials(submission.users?.full_name)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-ink truncate">{submission.users?.full_name}</p>
          <p className="text-[13px] truncate" style={{ color: '#5A5A5A' }}>{submission.work_items?.title}</p>
        </div>
        <p className="text-[12px] flex-shrink-0" style={{ color: '#8A8A8A' }}>Submitted {timeAgo(submission.submitted_at)}</p>
      </div>

      <div className="grid md:grid-cols-[1.4fr_1fr] gap-3 mb-5">
        <div className="bg-surface border border-edge rounded-xl p-[14px]">
          <p className="text-[12px] font-medium uppercase tracking-wide mb-2.5" style={{ color: '#5A5A5A' }}>The work</p>
          <div className="rounded-lg flex flex-col items-center justify-center border border-edge overflow-hidden mb-2" style={{ backgroundColor: '#F7F5F0', minHeight: 150 }}>
            {isImage && fileUrl ? (
              <img src={fileUrl} alt="Submitted work" className="max-h-[220px] w-auto object-contain" />
            ) : submission.file_path ? (
              <a href={fileUrl || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-3 text-[13px] font-semibold text-ink">
                <FileText className="w-4 h-4 flex-shrink-0" style={{ color: '#5A5A5A' }} />
                {submission.file_path.split('/').pop()}
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#5A5A5A' }} />
              </a>
            ) : (
              <p className="text-[13px] italic px-4 py-6" style={{ color: '#8A8A8A' }}>Nothing attached.</p>
            )}
          </div>
          {submission.content && <p className="text-[13.5px] text-ink-body whitespace-pre-wrap leading-relaxed">{submission.content}</p>}
        </div>

        <div className="bg-surface border border-edge rounded-xl p-[14px]">
          <p className="text-[12px] font-medium uppercase tracking-wide mb-2.5" style={{ color: '#5A5A5A' }}>Check against criteria</p>
          {criteriaLines.length === 0 ? (
            <p className="text-[13px] italic" style={{ color: '#8A8A8A' }}>No criteria written for this brief.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {criteriaLines.map((line: string, i: number) => (
                <label key={i} className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={ticked.has(i)} onChange={() => toggle(i)} className="mt-0.5 accent-brand w-4 h-4 flex-shrink-0" />
                  <span className="text-[13.5px] text-ink-body leading-snug">{line}</span>
                </label>
              ))}
            </div>
          )}

          <div className="border-t border-edge-subtle pt-3 mt-1">
            <p className="text-[12px] mb-1.5" style={{ color: '#5A5A5A' }}>Feedback to the student (optional)</p>
            <textarea
              value={feedback} onChange={e => setFeedback(e.target.value)} rows={4}
              placeholder="A note on what was strong, or what to improve."
              className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-[13px] text-danger-text mb-3">{error}</p>}

      {confirmVerify && (
        <div className="bg-surface-subtle border border-edge rounded-xl px-4 py-3 mb-3 flex items-center justify-between gap-3">
          <p className="text-[13px] text-ink">Some criteria are not ticked. Verify anyway?</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setConfirmVerify(false)} className="text-[13px] font-semibold text-ink-secondary px-3 py-1.5">Cancel</button>
            <button onClick={verify} className="text-[13px] font-semibold text-white px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#0F6E56' }}>Verify</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <button
            onClick={verify} disabled={loading}
            className="flex items-center gap-1.5 text-white text-[13px] font-semibold rounded-lg disabled:opacity-50 transition"
            style={{ backgroundColor: '#0F6E56', padding: '11px 20px' }}
          >
            <CheckCircle2 className="w-4 h-4" /> {loading ? 'Verifying…' : 'Verify work'}
          </button>
          <button
            onClick={returnForChanges} disabled={loading}
            className="flex items-center gap-1.5 text-[13px] font-semibold rounded-lg border transition disabled:opacity-50"
            style={{ backgroundColor: '#F7F5F0', borderColor: '#E7E4DE', color: '#1A1A1A', padding: '11px 20px' }}
          >
            Return for changes
          </button>
        </div>
        {history !== null && history.length > 0 && (
          <button onClick={() => setShowHistory(v => !v)} className="flex items-center gap-1.5 text-[12px]" style={{ color: '#8A8A8A' }}>
            <History className="w-3.5 h-3.5" /> {submission.users?.full_name}'s {history.length} earlier piece{history.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {showHistory && history && (
        <div className="mt-4 pt-4 border-t border-edge-subtle space-y-1.5">
          {history.map(h => (
            <div key={h.id} className="text-[12px] text-ink-secondary border-l-2 border-edge-subtle pl-2.5">
              <span className="font-semibold text-ink capitalize">{h.decision}</span>
              {' — '}{h.submissions?.work_items?.title}
              {' · '}{new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {h.feedback && <span className="block italic" style={{ color: '#8A8A8A' }}>"{h.feedback}"</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
