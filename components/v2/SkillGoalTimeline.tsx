'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getSkillGoalCheckins, uploadSkillCheckinEvidence, addSkillCheckin, publishSkillGoal, getSignedFileUrl } from '@/lib/supabase'
import { ChevronLeft, Plus, FilePlus, Target, CalendarClock, Rocket, BadgeCheck } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatTargetDate(d?: string) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// This renders inside two genuinely different design systems in this
// app -- the student shell's own `--app-*` CSS-variable theme
// (ProfilePanel/StudentSkillsPanel) and the org/employer "paper" shell's
// Tailwind-mapped ink/surface/edge classes (CandidateDetailPanel) --
// which don't share variable names, so a single hardcoded class set
// would look right in one and broken in the other. `variant` picks
// which token set to use; everything else about the component (data,
// layout, behaviour) is identical either way.
type Variant = 'app' | 'paper'
const TOKENS: Record<Variant, { surface: string; surfaceSubtle: string; border: string; text: string; textSecondary: string; textTertiary: string; textQuaternary: string; danger: string; brand: string }> = {
  app: {
    surface: 'bg-[var(--app-surface)]', surfaceSubtle: 'bg-[var(--app-surface-2)]', border: 'border-[var(--app-border)]',
    text: 'text-[var(--app-text)]', textSecondary: 'text-[var(--app-text-secondary)]', textTertiary: 'text-[var(--app-text-tertiary)]', textQuaternary: 'text-[var(--app-text-quaternary)]',
    danger: 'text-danger-text', brand: 'text-brand',
  },
  paper: {
    surface: 'bg-surface', surfaceSubtle: 'bg-surface-subtle', border: 'border-edge',
    text: 'text-ink', textSecondary: 'text-ink-secondary', textTertiary: 'text-ink-tertiary', textQuaternary: 'text-ink-quaternary',
    danger: 'text-danger-text', brand: 'text-brand',
  },
}

// Shared by the student's own skill goal view (can check in, can
// publish) and the employer/Discover read-only view of the exact same
// timeline (can't do either) -- one real log of dated, evidenced
// progress is the whole point, so there's only ever one version of it,
// just with the composer and publish button hidden when canCheckIn is
// false. RLS decides who can actually read which rows either way; this
// component doesn't re-decide that, it just renders whatever
// getSkillGoalCheckins returns.
export default function SkillGoalTimeline({
  goal, canCheckIn, studentId, variant = 'paper', onClose, onCheckedIn, onPublished,
}: {
  goal: { id: string; name: string; target?: string; target_date?: string; published_at?: string | null }
  canCheckIn: boolean
  studentId?: string
  variant?: Variant
  onClose: () => void
  onCheckedIn?: () => void
  onPublished?: () => void
}) {
  const t = TOKENS[variant]
  const [checkins, setCheckins] = useState<any[] | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [published, setPublished] = useState(!!goal.published_at)
  const [publishing, setPublishing] = useState(false)

  const load = () => { getSkillGoalCheckins(goal.id).then(({ data }) => setCheckins(data || [])) }
  useEffect(load, [goal.id])

  const publish = async () => {
    setPublishing(true)
    const { error } = await publishSkillGoal(goal.id)
    setPublishing(false)
    if (error) return
    setPublished(true)
    onPublished?.()
  }

  // Last 7 days, oldest first, today last -- a filled dot on any day
  // with at least one check-in. "Let's say today's the 13 and I check
  // in... that's 7 days" (direct feedback): a real week-at-a-glance
  // strip, not just a flat count, so consistency is visible in one
  // look rather than needing to read every entry's date.
  const streak = checkins ? Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const hit = checkins.some(c => sameDay(new Date(c.created_at), d))
    return { label: d.toLocaleDateString('en-GB', { weekday: 'narrow' }), hit, isToday: i === 6 }
  }) : null

  return createPortal((
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div className={`${t.surface} rounded-2xl shadow-2xl w-full max-w-lg max-h-[85dvh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between gap-2 px-5 py-4 border-b ${t.border} sticky top-0 ${t.surface}`}>
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={onClose} aria-label="Close" className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 ${t.textTertiary} transition flex-shrink-0`}><ChevronLeft className="w-4 h-4" /></button>
            <div className="min-w-0">
              <p className={`font-bold ${t.text} text-[15px] truncate`}>{goal.name}</p>
              <p className={`text-[12px] ${t.textTertiary}`}>
                {checkins === null ? 'Loading…' : `${checkins.length} check-in${checkins.length === 1 ? '' : 's'}`}
                {checkins && checkins.length > 0 && ` · since ${formatDate(checkins[checkins.length - 1].created_at)}`}
              </p>
            </div>
          </div>
          {published && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>
              <BadgeCheck className="w-3 h-3" /> Published
            </span>
          )}
        </div>

        <div className="p-5">
          {streak && (
            <div className="flex items-center gap-1.5 mb-4">
              {streak.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span
                    className={`w-full h-2 rounded-full ${d.hit ? '' : t.surfaceSubtle}`}
                    style={d.hit ? { backgroundColor: 'var(--status-success-text)' } : undefined}
                  />
                  <span className={`text-[9.5px] ${d.isToday ? `font-bold ${t.text}` : t.textQuaternary}`}>{d.label}</span>
                </div>
              ))}
            </div>
          )}

          {(goal.target || goal.target_date) && (
            <div className={`${t.surfaceSubtle} rounded-xl p-3.5 mb-4 space-y-1.5`}>
              {goal.target && (
                <p className={`flex items-start gap-1.5 text-[13px] ${t.textSecondary}`}><Target className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${t.textTertiary}`} /> {goal.target}</p>
              )}
              {goal.target_date && (
                <p className={`flex items-center gap-1.5 text-[12.5px] ${t.textTertiary}`}><CalendarClock className="w-3.5 h-3.5 flex-shrink-0" /> Target: {formatTargetDate(goal.target_date)}</p>
              )}
            </div>
          )}

          {canCheckIn && (
            <div className="flex items-center gap-2 mb-5">
              {!composerOpen && (
                <button onClick={() => setComposerOpen(true)} className={`flex items-center gap-1.5 text-[13px] font-semibold ${t.brand}`}>
                  <Plus className="w-3.5 h-3.5" /> Check in
                </button>
              )}
              {!published && checkins && checkins.length > 0 && !composerOpen && (
                <button
                  onClick={publish} disabled={publishing}
                  className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-lg bg-brand text-white hover:opacity-90 transition disabled:opacity-50 ml-auto"
                >
                  <Rocket className="w-3.5 h-3.5" /> {publishing ? 'Publishing…' : 'Publish to profile'}
                </button>
              )}
            </div>
          )}
          {canCheckIn && composerOpen && (
            <div className="-mt-3 mb-5">
              <CheckinComposer
                goalId={goal.id} studentId={studentId!} t={t}
                onDone={() => { setComposerOpen(false); load(); onCheckedIn?.() }}
                onCancel={() => setComposerOpen(false)}
              />
            </div>
          )}
          {canCheckIn && !published && (!checkins || checkins.length === 0) && (
            <p className={`text-[11.5px] ${t.textQuaternary} -mt-3 mb-5`}>Check in at least once before publishing — employers should see real progress, not an empty goal.</p>
          )}

          {checkins === null ? (
            <p className={`text-[13px] ${t.textTertiary}`}>Loading…</p>
          ) : checkins.length === 0 ? (
            <p className={`text-[13px] ${t.textTertiary}`}>No check-ins yet.</p>
          ) : (
            <div className="space-y-3">
              {checkins.map(c => <CheckinRow key={c.id} checkin={c} t={t} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  ), document.body)
}

function CheckinRow({ checkin, t }: { checkin: any; t: typeof TOKENS['paper'] }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const isImage = checkin.evidence_file_type?.startsWith('image/')
  useEffect(() => { if (checkin.evidence_file_path) getSignedFileUrl('submission-files', checkin.evidence_file_path).then(({ url }) => setFileUrl(url)) }, [checkin.evidence_file_path])

  return (
    <div className={`${t.surfaceSubtle} rounded-xl p-3.5`}>
      <p className={`text-[11.5px] font-semibold ${t.textTertiary} mb-1.5`}>{formatDate(checkin.created_at)}</p>
      <p className={`text-[13.5px] ${t.text} whitespace-pre-wrap leading-relaxed mb-2`}>{checkin.content}</p>
      {isImage && fileUrl ? (
        <img src={fileUrl} alt="" className={`w-full rounded-lg border ${t.border}`} />
      ) : (
        <a
          href={fileUrl || '#'} target="_blank" rel="noreferrer"
          className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${t.text} hover:opacity-80 transition`}
        >
          <FilePlus className={`w-3.5 h-3.5 flex-shrink-0 ${t.textTertiary}`} /> {fileUrl ? (checkin.evidence_file_path?.split('/').pop()) : 'Loading…'}
        </a>
      )}
    </div>
  )
}

// Same hard rule as the old self-reported skill form: no check-in
// without both the write-up AND the evidence file, every time.
function CheckinComposer({ goalId, studentId, t, onDone, onCancel }: { goalId: string; studentId: string; t: typeof TOKENS['paper']; onDone: () => void; onCancel: () => void }) {
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (!content.trim()) return setError('Write a couple of sentences on what you did.')
    if (!file) return setError('Attach a photo, screenshot, or the work itself — that\'s the evidence.')
    setSaving(true); setError('')
    const { path, error: upErr } = await uploadSkillCheckinEvidence(studentId, file)
    if (upErr || !path) { setSaving(false); setError("Couldn't upload that — try again."); return }
    const { error: err } = await addSkillCheckin(goalId, { content: content.trim(), evidence_file_path: path, evidence_file_type: file.type })
    setSaving(false)
    if (err) { setError("Couldn't save — try again."); return }
    onDone()
  }

  return (
    <div className={`${t.surface} border ${t.border} rounded-xl p-3.5 space-y-2`}>
      <textarea
        value={content} onChange={e => setContent(e.target.value)} autoFocus rows={3}
        placeholder="What did you do this week? e.g. Today I learned how to use the pen tool to trace a logo."
        className={`w-full ${t.surfaceSubtle} border ${t.border} rounded-lg px-3 py-2 text-[13px] ${t.text} outline-none focus:border-brand transition resize-none leading-relaxed`}
      />
      <button onClick={() => fileRef.current?.click()} className={`text-[12px] font-semibold ${t.textSecondary} hover:opacity-80 transition`}>
        {file ? file.name : 'Attach a photo, screenshot, or the work (required)'}
      </button>
      <input ref={fileRef} type="file" accept="image/*,video/*,application/pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
      {error && <p className={`text-[12px] ${t.danger}`}>{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={!content.trim() || !file || saving} className="px-3.5 py-2 rounded-lg bg-brand text-white text-[12px] font-semibold disabled:opacity-40">
          {saving ? 'Saving…' : 'Post check-in'}
        </button>
        <button onClick={onCancel} disabled={saving} className={`px-3.5 py-2 text-[12px] font-semibold ${t.textSecondary}`}>Cancel</button>
      </div>
    </div>
  )
}
