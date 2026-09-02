'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getApplicationsForEmployer, getApplicationsForOrganisation, moveApplicationStage,
  setApplicationPrivateNote, getApplicationActivity, APPLICATION_STAGES,
} from '@/lib/supabase'
import type { ApplicationStage } from '@/lib/supabase'
import { Bell, Shield, CheckCircle2, X, PenLine } from 'lucide-react'

// Complete Build Spec v1.0, Part 2 (job tracker) + Part 3 (Candidates
// -- "The same board as the job tracker in Part 2, from the employer's
// side"). One component, two viewers: org watches only (plus a
// private note only its own staff see), employer owns stage moves.
// Every colour/label here is a pinned value from the spec, used
// exactly -- this screen's shapes are already dark-agnostic (surface/
// edge/ink tokens), so it reads correctly on both org (light-capable)
// and employer shells without a separate build.

const STAGE_META: Record<ApplicationStage, { label: string; headingColor: string }> = {
  applied: { label: 'Applied', headingColor: '#185FA5' },
  reviewing: { label: 'Reviewing', headingColor: '#854F0B' },
  shortlisted: { label: 'Shortlisted', headingColor: '#854F0B' },
  interview: { label: 'Interview', headingColor: '#854F0B' },
  offer: { label: 'Offer', headingColor: '#854F0B' },
  hired: { label: 'Hired', headingColor: '#0F6E56' },
  not_progressing: { label: 'Not progressing', headingColor: '#5F5E5A' },
}
const PILL: Record<ApplicationStage, { bg: string; text: string }> = {
  applied: { bg: '#E6F1FB', text: '#185FA5' },
  reviewing: { bg: '#FAEEDA', text: '#854F0B' },
  shortlisted: { bg: '#FAEEDA', text: '#854F0B' },
  interview: { bg: '#FAEEDA', text: '#854F0B' },
  offer: { bg: '#FAEEDA', text: '#854F0B' },
  hired: { bg: '#E1F5EE', text: '#0F6E56' },
  not_progressing: { bg: '#F1EFE8', text: '#5F5E5A' },
}

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
function age(dob?: string) {
  if (!dob) return null
  const a = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
  return a
}
function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function JobTrackerBoard({ viewer, employerId, organisationId }: { viewer: 'org' | 'employer'; employerId?: string; organisationId?: string }) {
  const { user } = useAuth()
  const [apps, setApps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ApplicationStage | 'all'>('all')
  const [openApp, setOpenApp] = useState<any | null>(null)

  const load = () => {
    setLoading(true)
    const p = viewer === 'employer' ? getApplicationsForEmployer(employerId!) : getApplicationsForOrganisation(organisationId!)
    p.then(({ data }) => { setApps(data || []); setLoading(false) })
  }
  useEffect(load, [viewer, employerId, organisationId])

  const filtered = filter === 'all' ? apps : apps.filter(a => a.stage === filter)
  const byStage = (stage: ApplicationStage) => filtered.filter(a => a.stage === stage)

  // Notification bar (org view only) -- the single latest event.
  const latest = viewer === 'org' && apps.length > 0
    ? [...apps].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null

  return (
    <div>
      {latest && (
        <div className="flex items-center gap-2.5 rounded-lg px-[13px] py-[11px] mb-5" style={{ backgroundColor: '#E6F1FB' }}>
          <Bell className="w-4 h-4 flex-shrink-0" style={{ color: '#185FA5' }} />
          <p className="text-[13px]" style={{ color: '#0C447C' }}>
            <span className="font-medium">{latest.student?.full_name}</span> applied to{' '}
            <span className="font-medium">{latest.opportunity?.title || 'a role'}</span> at{' '}
            <span className="font-medium">{latest.employer?.full_name}</span> · {timeAgo(latest.created_at)}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[18px] font-medium text-ink">Applications</p>
          <p className="text-[13px] text-ink-tertiary">
            {viewer === 'org' ? 'Your students, across all opportunities' : 'Candidates across every role you\'re hiring for'}
          </p>
        </div>
        <select
          value={filter} onChange={e => setFilter(e.target.value as any)}
          className="bg-surface border border-edge rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
        >
          <option value="all">All stages</option>
          {APPLICATION_STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-[13px] text-ink-tertiary">Loading…</p>
      ) : apps.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[14px] font-semibold text-ink mb-1">Nothing here yet</p>
          <p className="text-[13px] text-ink-tertiary">
            {viewer === 'org' ? "It'll fill up as your students apply, or an employer's interest is accepted." : 'Candidates land here once someone applies or you accept an interest request.'}
          </p>
        </div>
      ) : (
        // grid-auto-columns minmax(...,1fr), not a fixed 180px flex
        // row -- fixed-width columns left a strip of dead space on a
        // wide screen instead of actually filling it. Each column
        // still never shrinks below 180px (still scrolls on a narrow
        // window), but stretches evenly to fill whatever's there on a
        // laptop, the same "fill the pane" fix as everywhere else
        // this round.
        <div
          className="grid gap-3 overflow-x-auto pb-2"
          style={{ gridTemplateColumns: `repeat(${APPLICATION_STAGES.length}, minmax(180px, 1fr))`, scrollbarWidth: 'thin' }}
        >
          {APPLICATION_STAGES.map(stage => (
            <div key={stage} className="min-w-0 bg-surface-subtle/60 rounded-xl p-2">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold mb-2.5 px-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STAGE_META[stage].headingColor }} />
                <span style={{ color: STAGE_META[stage].headingColor }}>{STAGE_META[stage].label}</span>
                <span className="text-ink-quaternary font-normal">· {byStage(stage).length}</span>
              </p>
              <div className="space-y-2 min-h-[40px]">
                {byStage(stage).length === 0 ? (
                  <p className="text-[11px] text-ink-quaternary px-1">—</p>
                ) : byStage(stage).map(a => <AppCard key={a.id} app={a} onClick={() => setOpenApp(a)} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {openApp && (
        <ApplicationDetail
          app={openApp} viewer={viewer} actorId={user?.id || ''}
          onClose={() => setOpenApp(null)}
          onChanged={() => { load(); setOpenApp(null) }}
        />
      )}
    </div>
  )
}

function AppCard({ app, onClick }: { app: any; onClick: () => void }) {
  const a = age(app.student?.date_of_birth)
  const isMinor = a !== null && a < 18
  const hired = app.stage === 'hired'
  return (
    <button onClick={onClick} className="w-full text-left bg-surface border border-edge rounded-xl px-[12px] py-[11px] hover:border-brand hover:shadow-sm transition">
      <div className="flex items-center gap-2 mb-1.5">
        {hired ? (
          <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#E1F5EE' }}>
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#0F6E56' }} />
          </span>
        ) : (
          <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-medium" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
            {initials(app.student?.full_name)}
          </span>
        )}
        <p className="text-[13px] font-medium text-ink truncate flex-1">{app.student?.full_name}</p>
        {app.private_note && <PenLine className="w-3 h-3 text-ink-quaternary flex-shrink-0" />}
      </div>
      <p className="text-[12px] text-ink-tertiary truncate">{app.opportunity?.title || 'Direct interest'}</p>
      <p className="text-[12px] truncate" style={{ color: '#8A8A8A' }}>{app.employer?.full_name || ''}{app.employer?.full_name && a !== null ? ' · ' : ''}{a !== null ? `${a} yrs` : ''}</p>
      {isMinor && (
        <div className="border-t border-edge-subtle mt-2 pt-2 flex items-center gap-1" style={{ color: '#854F0B' }}>
          <Shield className="w-3 h-3 flex-shrink-0" />
          <span className="text-[11px]">You arrange contact</span>
        </div>
      )}
    </button>
  )
}

function ApplicationDetail({ app, viewer, actorId, onClose, onChanged }: {
  app: any; viewer: 'org' | 'employer'; actorId: string; onClose: () => void; onChanged: () => void
}) {
  const [activity, setActivity] = useState<any[]>([])
  const [note, setNote] = useState(app.private_note || '')
  const [moving, setMoving] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const [noteError, setNoteError] = useState('')

  useEffect(() => { getApplicationActivity(app.id).then(({ data }) => setActivity(data || [])) }, [app.id])

  const a = age(app.student?.date_of_birth)
  const isMinor = a !== null && a < 18
  const pill = PILL[app.stage as ApplicationStage]

  const move = async (stage: ApplicationStage) => {
    setMoving(true)
    await moveApplicationStage(app.id, stage, actorId)
    setMoving(false)
    onChanged()
  }
  const saveNote = async () => {
    setSavingNote(true); setNoteError(''); setNoteSaved(false)
    // Was never checking this before -- a failed save and a
    // successful one looked identical (button just flips back to
    // "Save note" either way), which is exactly "I save it, where does
    // it go?" -- there was no way to tell it had actually happened.
    const { error } = await setApplicationPrivateNote(app.id, note.trim())
    setSavingNote(false)
    if (error) { setNoteError(error.message || "Couldn't save — try again."); return }
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2500)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge-subtle">
          <div>
            <p className="text-[14px] font-medium text-ink">{app.student?.full_name} — {app.opportunity?.title || 'Direct interest'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium px-[10px] py-[4px] rounded-full" style={{ backgroundColor: pill.bg, color: pill.text }}>{STAGE_META[app.stage as ApplicationStage].label}</span>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-muted text-ink-tertiary"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {viewer === 'employer' && app.stage !== 'hired' && app.stage !== 'not_progressing' && (
            <div>
              <p className="text-[12px] font-semibold text-ink-tertiary mb-2">Move to</p>
              <div className="flex flex-wrap gap-1.5">
                {APPLICATION_STAGES.filter(s => s !== app.stage).map(s => (
                  <button
                    key={s} onClick={() => move(s)} disabled={moving}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-edge text-ink-secondary hover:border-brand transition disabled:opacity-40"
                  >
                    {STAGE_META[s].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isMinor && (
            <div className="rounded-lg px-[12px] py-[10px] flex items-start gap-2" style={{ backgroundColor: '#E1F5EE' }}>
              <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#0F6E56' }} />
              <p className="text-[12px]" style={{ color: '#0F6E56' }}>
                {app.student?.full_name} is {a}. The interview is arranged through you, not directly with them.
              </p>
            </div>
          )}

          <div>
            <p className="text-[12px] font-medium text-ink-tertiary mb-2">Activity</p>
            {activity.length === 0 ? (
              <p className="text-[12px] text-ink-quaternary">No activity yet.</p>
            ) : (
              <div className="space-y-2.5">
                {activity.map(ev => (
                  <div key={ev.id} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-ink-tertiary flex-shrink-0 mt-1.5" />
                    <div>
                      <p className="text-[12.5px] text-ink"><span className="font-semibold">{ev.detail || ev.action}</span></p>
                      <p className="text-[11px] text-ink-quaternary">{ev.actor?.full_name || 'System'} · {new Date(ev.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {viewer === 'org' && (
            <div>
              <label className="block text-[12px] font-semibold text-ink-tertiary mb-1.5">Private note (only your staff see this)</label>
              {/* Answers "where does it go" directly -- it's saved
                  against this exact application, nowhere else, and
                  will be here again next time this card is opened. */}
              <p className="text-[11px] text-ink-quaternary mb-1.5">Stays attached to this candidate's card — visible to your own staff only, never the employer or student.</p>
              <textarea
                value={note} onChange={e => setNote(e.target.value)} rows={3}
                className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-brand transition resize-none"
              />
              {noteError && <p className="text-[12px] text-danger-text mt-1.5">{noteError}</p>}
              <div className="flex items-center gap-2 mt-2">
                <button onClick={saveNote} disabled={savingNote} className="text-[12px] font-semibold text-brand disabled:opacity-40">
                  {savingNote ? 'Saving…' : 'Save note'}
                </button>
                {noteSaved && <span className="text-[12px] font-semibold text-success-text">Saved ✓</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
