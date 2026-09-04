'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getWorkItems, createWorkItem, getGroups, createGroup, getGroupMembers,
  uploadWorkItemAttachment, uploadSubmissionFileFor, submitWorkForStudents, getSignedFileUrl, startWorkItemSession,
  closeWorkItem, reopenWorkItem, getWorkItemRecordings, getBriefStatusSummaries,
} from '@/lib/supabase'
import { TextField, PrimaryButton, ErrorBanner, Spinner } from '@/components/v2/Field'
import WorkshopSession from '@/components/v2/WorkshopSession'
import type { WorkItem, Group } from '@/lib/types'
import { Plus, X, Paperclip, UploadCloud, FileText, ExternalLink, CalendarClock, Users2, Video, MapPin, Ban, RotateCcw, Film, Download, Clock, PenLine, CheckCircle2 } from 'lucide-react'

type ItemType = 'brief' | 'course' | 'workshop'

const COPY: Record<ItemType, { heading: string; button: string; empty: string }> = {
  brief:    { heading: 'Briefs',   button: 'New brief',   empty: 'No briefs yet.' },
  course:   { heading: 'Courses',  button: 'New course',  empty: 'No courses yet.' },
  workshop: { heading: 'Workshops', button: 'New workshop', empty: 'No workshops yet.' },
}

// Institution "Briefs", provider "Courses", and both roles' "Workshops"
// are the same underlying work_items table, filtered by type. Briefs
// gets the full rebuilt form (topic/assignment/attachments/deadline/
// group) per spec; Courses/Workshops keep the simpler creation form —
// the old platform's course system was a whole separate multi-week
// session-scheduling engine (course_sessions, live classrooms, project
// days) that doesn't exist in this schema, so "match the old flow" here
// means the field set, not resurrecting that entire subsystem.
export default function WorkItemsPanel({ type }: { type: ItemType }) {
  if (type === 'brief') return <BriefsPanel />

  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const copy = COPY[type]

  const load = () => {
    if (!user?.organisation_id) return
    getWorkItems(user.organisation_id).then(({ data }) => {
      // An ended workshop/course moves to the Dashboard's "Previous"
      // list instead of cluttering the live one — it's done, there's
      // nothing left to do with it here.
      setItems((data || []).filter((i: any) => i.type === type && !i.ended_at))
      setLoading(false)
    })
  }
  useEffect(load, [user?.organisation_id, type])

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="font-bold text-ink text-[15px]">{copy.heading}</p>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 bg-brand text-white font-semibold text-[13px] px-4 py-2 rounded-lg hover:bg-brand-hover transition"
        >
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? 'Cancel' : copy.button}
        </button>
      </div>

      {showCreate && <CreateWorkItemForm type={type} onCreated={() => { setShowCreate(false); load() }} />}

      {loading ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-ink-tertiary text-[14px]">{copy.empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => <WorkItemCard key={item.id} item={item} onChanged={load} />)}
        </div>
      )}
    </div>
  )
}

// Briefs get their own top-level tabs, not a button that reveals a
// toggle — "Briefs" (the list + create-new) and "Upload work students
// already do" are two separate, always-reachable places.
type BriefTab = 'briefs' | 'upload'

function BriefsPanel() {
  const { user } = useAuth()
  const [tab, setTab] = useState<BriefTab>('briefs')
  const [items, setItems] = useState<any[]>([])
  const [summaries, setSummaries] = useState<Awaited<ReturnType<typeof getBriefStatusSummaries>>>({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = () => {
    if (!user?.organisation_id) return
    getWorkItems(user.organisation_id).then(({ data }) => {
      const briefs = (data || []).filter((i: any) => i.type === 'brief')
      setItems(briefs)
      setLoading(false)
      getBriefStatusSummaries(briefs, user.organisation_id!).then(setSummaries)
    })
  }
  useEffect(load, [user?.organisation_id])

  return (
    <div>
      <div className="flex gap-1 mb-5 border-b border-edge-subtle">
        {([['briefs', 'Briefs'], ['upload', 'Upload work students already do']] as [BriefTab, string][]).map(([key, label]) => (
          <button
            key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-[14px] font-semibold border-b-2 -mb-px transition ${
              tab === key ? 'text-ink border-brand' : 'text-ink-tertiary border-transparent hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'briefs' ? (
        <div>
          <div className="flex items-center justify-between mb-5">
            <p className="font-bold text-ink text-[15px]">Briefs</p>
            {/* Outline, not filled -- matches the reference exactly.
                "+ Create" is a plain outline button here since the
                brand-orange fill is reserved for the one true primary
                action on a screen, which per the house style is the
                Create button INSIDE the create form, not this entry
                point to it. */}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 border border-edge text-ink font-semibold text-[13px] px-4 py-2 rounded-lg hover:border-edge-input transition"
            >
              <Plus className="w-3.5 h-3.5" /> Create
            </button>
          </div>
          {showCreate && (
            <NewBriefForm onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />
          )}
          {loading ? (
            <p className="text-ink-tertiary text-[14px]">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-ink-tertiary text-[14px]">No briefs yet.</p>
          ) : (
            <div className="space-y-3">
              {items.map(item => <BriefCard key={item.id} item={item} summary={summaries[item.id]} onChanged={load} />)}
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className="font-bold text-ink text-[15px] mb-5">Upload work students already do</p>
          <UploadExistingWorkForm onCreated={() => { setTab('briefs'); load() }} />
        </div>
      )}
    </div>
  )
}

// House style (LERN Build Spec: Briefs and Interest Received, v1.0):
// clean white card, one hairline border, 12px radius, one status pill
// per card (blue/amber/green, the ONLY three states a card shows, even
// though the underlying per-student truth has more granularity), a
// divider, at-a-glance counts on the surface, and exactly one quiet
// brand-coloured action whose label depends on state. Draft/Scheduled
// keep their own separate badge (a fourth, staff-only state the spec
// doesn't cover, since a draft isn't visible to anyone to have a real
// status yet).
const STATUS_PILL = {
  new:      { label: 'New',         bg: '#E6F1FB', text: '#185FA5' },
  progress: { label: 'In progress', bg: '#FAEEDA', text: '#854F0B' },
  verified: { label: 'Verified',    bg: '#E1F5EE', text: '#0F6E56' },
}

function BriefCard({ item, onChanged, summary }: { item: any; onChanged: () => void; summary?: { assigned: number; submitted: number; verified: number; returned: number; overdue: boolean } }) {
  const router = useRouter()
  const pathname = usePathname()
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const revoke = async () => {
    setBusy(true); setActionError('')
    const { error } = await closeWorkItem(item.id)
    setBusy(false); setConfirmingRevoke(false)
    if (error) { setActionError(error.message); return }
    onChanged()
  }
  const reopen = async () => {
    setBusy(true); setActionError('')
    const { error } = await reopenWorkItem(item.id)
    setBusy(false)
    if (error) { setActionError(error.message); return }
    onChanged()
  }

  const isDraftOrScheduled = item.publish_state === 'draft' || item.publish_state === 'scheduled'
  const assigned = summary?.assigned ?? 0
  const notStarted = Math.max(0, assigned - (summary?.submitted ?? 0))
  const pendingReview = Math.max(0, (summary?.submitted ?? 0) - (summary?.verified ?? 0) - (summary?.returned ?? 0))
  const allVerified = assigned > 0 && (summary?.verified ?? 0) === assigned

  // One of exactly three pills, per house style -- collapsing the
  // richer per-student truth (submitted/overdue/returned) into New /
  // In progress / Verified for the card surface.
  const status = allVerified ? STATUS_PILL.verified
    : (summary?.submitted ?? 0) > 0 || summary?.overdue ? STATUS_PILL.progress
    : STATUS_PILL.new

  const actionLabel = allVerified ? 'See verified work' : pendingReview > 0 ? 'Review submitted' : 'Preview for students'

  const deadlineLabel = item.deadline
    ? `due ${new Date(item.deadline).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
    : 'no deadline set'

  return (
    // bg-surface, not bg-white -- has to adapt to the org's own theme
    // (this screen has a real dark mode, per the reference screenshot),
    // not stay flat white regardless.
    <div className="bg-surface border border-edge rounded-xl px-5 py-4">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white ${allVerified ? 'bg-[#0F6E56]' : 'bg-[#185FA5]'}`}>
          {allVerified ? <CheckCircle2 className="w-[18px] h-[18px]" /> : <FileText className="w-[18px] h-[18px]" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-ink text-[15px] leading-snug truncate">{item.title}</p>
            {isDraftOrScheduled ? (
              <span className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-muted text-ink-tertiary">
                {item.publish_state === 'draft' ? 'Draft' : 'Scheduled'}
              </span>
            ) : (
              <span className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: status.bg, color: status.text }}>
                {status.label}
              </span>
            )}
          </div>
          <p className="text-[13px] text-ink-tertiary mt-0.5">
            {item.topic ? `${item.topic}, ` : ''}{deadlineLabel} · {item.groups?.name || 'Whole organisation'}
          </p>

          {!isDraftOrScheduled && assigned > 0 && (
            <>
              <div className="border-t border-edge-subtle my-3" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-5 text-[12px] text-ink-secondary">
                  {allVerified ? (
                    <>
                      <span>{summary?.verified} verified</span>
                      {(summary?.returned ?? 0) > 0 && <span>{summary?.returned} returned</span>}
                    </>
                  ) : (
                    <>
                      <span>{summary?.submitted ?? 0} submitted</span>
                      <span>{notStarted} in progress</span>
                    </>
                  )}
                </div>
                {/* Review submitted work's own real queue exists
                    (/review); a dedicated "preview as a student would
                    see it" and a filtered "verified work for this
                    brief" view don't yet -- the review queue is the
                    closest real destination for all three until those
                    exist, rather than a dead button. */}
                <button
                  onClick={() => router.push(pathname.split('/').slice(0, 2).join('/') + '/review')}
                  className="flex items-center gap-1 text-[13px] font-semibold hover:underline flex-shrink-0" style={{ color: '#185FA5' }}
                >
                  {actionLabel} <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </>
          )}

          <div className="flex items-center justify-end mt-2">
            {confirmingRevoke ? (
              <span className="flex items-center gap-2 text-[12px]">
                <span className="text-ink-tertiary">{item.closed_at ? 'Reopen this brief?' : 'Revoke this brief?'}</span>
                <button onClick={item.closed_at ? reopen : revoke} disabled={busy} className="font-semibold text-danger-text hover:underline">Yes</button>
                <button onClick={() => setConfirmingRevoke(false)} className="font-semibold text-ink-tertiary hover:underline">Cancel</button>
              </span>
            ) : (
              <button onClick={() => setConfirmingRevoke(true)} className="text-[11px] font-medium text-ink-quaternary hover:text-ink-tertiary transition">
                {item.closed_at ? 'Reopen' : 'Revoke'}
              </button>
            )}
          </div>
          {actionError && <p className="text-[12px] text-danger-text mt-2">{actionError}</p>}
        </div>
      </div>
    </div>
  )
}

function WorkItemCard({ item, onChanged, summary }: { item: any; onChanged: () => void; summary?: { assigned: number; submitted: number; verified: number; returned: number; overdue: boolean } }) {
  const attachments = item.work_item_attachments || []
  const [inSession, setInSession] = useState(false)
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [recordings, setRecordings] = useState<any[] | null>(null)

  const isSession = item.type === 'workshop' || item.type === 'course'
  useEffect(() => {
    if (!isSession) return
    getWorkItemRecordings(item.id).then(({ data }) => setRecordings(data || []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, inSession])

  const start = async () => {
    await startWorkItemSession(item.id) // fans out "session has started, join now" the first time only
    setInSession(true)
    onChanged()
  }

  const revoke = async () => {
    setBusy(true)
    setActionError('')
    const { error } = await closeWorkItem(item.id)
    setBusy(false)
    setConfirmingRevoke(false)
    if (error) { setActionError(error.message); return }
    onChanged()
  }

  const reopen = async () => {
    setBusy(true)
    setActionError('')
    const { error } = await reopenWorkItem(item.id)
    setBusy(false)
    if (error) { setActionError(error.message); return }
    onChanged()
  }

  return (
    <div className={`border border-edge-subtle rounded-xl px-4 py-3.5 ${item.closed_at ? 'opacity-70' : ''}`}>
      <div className="flex items-center justify-between mb-1 gap-2">
        <p className="font-bold text-ink text-[14px] min-w-0 truncate">{item.title}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {item.publish_state === 'draft' && (
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary bg-surface-muted px-2 py-0.5 rounded-full">
              <PenLine className="w-3 h-3" /> Draft
            </span>
          )}
          {item.publish_state === 'scheduled' && (
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-brand bg-accent-bg px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />
              Scheduled {item.scheduled_for && new Date(item.scheduled_for).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {item.closed_at ? (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-danger-text bg-danger-bg px-2 py-0.5 rounded-full">
              Revoked
            </span>
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary bg-surface-muted px-2 py-0.5 rounded-full">
              {item.visibility}
            </span>
          )}
          {confirmingRevoke ? (
            <span className="flex items-center gap-1 text-[11px]">
              <span className="text-ink-tertiary">Revoke?</span>
              <button onClick={revoke} disabled={busy} className="font-semibold text-danger-text hover:underline">Yes</button>
              <button onClick={() => setConfirmingRevoke(false)} className="font-semibold text-ink-tertiary hover:underline">Cancel</button>
            </span>
          ) : item.closed_at ? (
            <button onClick={reopen} disabled={busy} title="Reopen" className="text-ink-tertiary hover:text-brand transition">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button onClick={() => setConfirmingRevoke(true)} title="Revoke — stop offering this to students" className="text-ink-tertiary hover:text-danger-text transition">
              <Ban className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {item.topic && <p className="text-[12px] text-ink-tertiary mb-1.5">{item.topic}</p>}
      {(item.assignment || item.description) && <p className="text-[13px] text-ink-secondary mb-2 whitespace-pre-wrap">{item.assignment || item.description}</p>}
      <p className="text-[12px] text-ink-tertiary mb-2"><span className="font-semibold">Criteria:</span> {item.criteria}</p>
      <div className="flex items-center gap-3.5 flex-wrap text-[12px] text-ink-tertiary">
        {item.deadline && (
          <span className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> Due {new Date(item.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        )}
        <span className="flex items-center gap-1"><Users2 className="w-3.5 h-3.5" /> {item.groups?.name || 'Whole organisation'}</span>
        {summary && summary.overdue && (
          <span className="font-semibold text-danger-text">Overdue</span>
        )}
        {(item.type === 'workshop' || item.type === 'course') && item.mode === 'online' && (
          <span className="flex items-center gap-1 text-success-text font-semibold"><Video className="w-3.5 h-3.5" /> Online</span>
        )}
        {(item.type === 'workshop' || item.type === 'course') && item.mode === 'in_person' && (
          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {item.location || 'In person'}</span>
        )}
        {(item.type === 'workshop' || item.type === 'course') && item.mode === 'online' && item.starts_at && !item.started_at && (
          <span className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> Starts {new Date(item.starts_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>
      {summary && item.type === 'brief' && item.publish_state === 'posted' && (
        <StatusRollup summary={summary} />
      )}
      {(item.type === 'workshop' || item.type === 'course') && item.mode === 'online' && !item.closed_at && (
        item.ended_at ? (
          <span className="inline-flex items-center gap-1.5 bg-danger-bg text-danger-text font-semibold text-[12px] px-3.5 py-2 rounded-lg mt-3">
            <Video className="w-3.5 h-3.5" /> Ended
          </span>
        ) : (
          <button
            onClick={start}
            className="flex items-center gap-1.5 bg-success-solid text-white font-semibold text-[12px] px-3.5 py-2 rounded-lg mt-3 hover:bg-success-solid-hover transition"
          >
            <Video className="w-3.5 h-3.5" /> {item.started_at ? 'Join session' : 'Start session'}
          </button>
        )
      )}
      {actionError && <p className="text-[12px] text-danger-text mt-2">{actionError}</p>}
      {recordings && recordings.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-edge-subtle">
          <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <Film className="w-3 h-3" /> Recordings
          </p>
          <div className="flex flex-wrap gap-1.5">
            {recordings.filter(r => r.status === 'available').map(r => <RecordingChip key={r.id} recording={r} />)}
          </div>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-edge-subtle">
          {attachments.map((a: any) => <AttachmentChip key={a.id} attachment={a} />)}
        </div>
      )}
      {inSession && (
        <WorkshopSession
          workItemId={item.id} title={item.title} canEnd
          onClose={() => setInSession(false)}
          onEnded={onChanged}
        />
      )}
    </div>
  )
}

// Classroom's "x of y turned in" roll-up, in LERN's own verify-not-grade
// language: submitted / verified / returned, against how many the brief
// is actually assigned to. Nothing to show for a brand-new brief nobody
// has touched yet — that's just "New", the implicit zero state.
function StatusRollup({ summary }: { summary: { assigned: number; submitted: number; verified: number; returned: number; overdue: boolean } }) {
  if (summary.assigned === 0) return null
  const notStarted = summary.assigned - summary.submitted
  return (
    <div className="flex items-center gap-3 flex-wrap text-[11px] font-semibold mt-2.5 pt-2.5 border-t border-edge-subtle">
      <span className="text-ink-secondary">{summary.submitted} of {summary.assigned} turned in</span>
      {summary.verified > 0 && <span className="text-success-text">{summary.verified} verified</span>}
      {summary.returned > 0 && <span className="text-danger-text">{summary.returned} returned</span>}
      {notStarted > 0 && <span className="text-ink-quaternary font-normal">{notStarted} new</span>}
    </div>
  )
}

// file_list is a JSONB array — [{ path, size }] for a recording saved
// via the local (host-only) path, vs Agora's own file list shape once
// Cloud Recording is live. Only the first file is offered here; a
// mixed multi-file Cloud Recording result can be extended later.
function RecordingChip({ recording }: { recording: any }) {
  const [url, setUrl] = useState<string | null>(null)
  const file = recording.file_list?.[0]
  const isLocal = recording.resource_id === 'local'
  const open = async () => {
    if (!file?.path) return
    if (url) return window.open(url, '_blank')
    const { url: signed } = await getSignedFileUrl('session-recordings', file.path)
    if (signed) { setUrl(signed); window.open(signed, '_blank') }
  }
  return (
    <button onClick={open} className="flex items-center gap-1.5 bg-surface-subtle border border-edge rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink-secondary hover:border-brand transition">
      <Download className="w-3 h-3" />
      {new Date(recording.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      {isLocal && <span className="text-ink-quaternary font-normal">· host only</span>}
    </button>
  )
}

function AttachmentChip({ attachment }: { attachment: any }) {
  const [url, setUrl] = useState<string | null>(null)
  const open = async () => {
    if (url) return window.open(url, '_blank')
    const { url: signed } = await getSignedFileUrl('work-item-attachments', attachment.file_path)
    if (signed) { setUrl(signed); window.open(signed, '_blank') }
  }
  return (
    <button onClick={open} className="flex items-center gap-1.5 bg-surface-subtle border border-edge rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink-secondary hover:border-brand transition">
      <Paperclip className="w-3 h-3" /> {attachment.file_name}
    </button>
  )
}

// Assign-to picker: pick an existing group, or create one inline --
// orgs start with zero groups, so this has to be usable from empty.
function GroupPicker({ organisationId, value, onChange, required }: { organisationId?: string; value: string; onChange: (id: string) => void; required?: boolean }) {
  const { user } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    if (!organisationId) return
    getGroups(organisationId).then(({ data }) => setGroups(data || []))
  }
  useEffect(load, [organisationId])

  const handleCreate = async () => {
    if (!newName.trim() || !organisationId || !user) return
    setBusy(true)
    const { data, error } = await createGroup(organisationId, user.id, newName.trim())
    setBusy(false)
    if (!error && data) {
      setGroups(prev => [...prev, data as Group])
      onChange((data as Group).id)
      setNewName(''); setCreating(false)
    }
  }

  return (
    <label className="block mb-5">
      <span className="block text-[13px] font-semibold text-ink mb-1.5">
        Assign to {required ? '' : <span className="text-ink-tertiary font-normal">(leave blank for the whole organisation)</span>}
      </span>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition"
        >
          <option value="">{required ? 'Select a group…' : 'Whole organisation'}</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button type="button" onClick={() => setCreating(v => !v)} className="px-3 py-2.5 rounded-lg border border-edge text-[13px] font-semibold text-ink-secondary hover:border-brand transition flex-shrink-0">
          + New group
        </button>
      </div>
      {creating && (
        <div className="flex gap-2 mt-2">
          <input
            value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Year 12 Media Studies" autoFocus
            className="flex-1 bg-surface border border-edge rounded-lg px-3 py-2 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
          />
          <button type="button" onClick={handleCreate} disabled={busy || !newName.trim()} className="px-3.5 py-2 rounded-lg bg-brand text-white text-[13px] font-semibold disabled:opacity-40">
            Add
          </button>
        </div>
      )}
    </label>
  )
}

function FileDropzone({ files, onChange, multiple }: { files: File[]; onChange: (files: File[]) => void; multiple?: boolean }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (list: FileList | null) => {
    if (!list) return
    onChange(multiple ? [...files, ...Array.from(list)] : [Array.from(list)[0]])
  }

  return (
    <div className="mb-5">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl py-7 cursor-pointer transition ${
          dragOver ? 'border-brand bg-accent-bg' : 'border-edge hover:border-edge-input'
        }`}
      >
        <UploadCloud className="w-5 h-5 text-ink-tertiary" />
        <p className="text-[13px] font-semibold text-ink">Drag and drop, or click to choose {multiple ? 'files' : 'a file'}</p>
        <p className="text-[11px] text-ink-quaternary">PDF, Word, PowerPoint, or image · up to 25MB</p>
        <input
          ref={inputRef} type="file" multiple={multiple} className="hidden"
          onChange={e => addFiles(e.target.files)}
        />
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1.5 bg-surface-subtle border border-edge rounded-full pl-2.5 pr-1.5 py-1 text-[11px] font-semibold text-ink-secondary">
              <FileText className="w-3 h-3" /> {f.name}
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="hover:text-danger-text">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Courses/Workshops — both online-or-in-person, both with a real
// deadline and topic/description, not just a bare title+criteria.
function CreateWorkItemForm({ type, onCreated }: { type: ItemType; onCreated: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [criteria, setCriteria] = useState('')
  const [deadline, setDeadline] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [mode, setMode] = useState<'online' | 'in_person'>('online')
  const [location, setLocation] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) return setError('Give it a title.')
    if (!criteria.trim()) return setError('Criteria is required — this is what the tutor checks the work against, and what makes the green tick mean something.')
    if (mode === 'in_person' && !location.trim()) return setError(`Add where the ${type} is happening.`)
    if (!user?.organisation_id) return setError("Your account isn't linked to an organisation yet — try refreshing the page.")

    setLoading(true)
    const { error: createError } = await createWorkItem(user.organisation_id, user.id, {
      type, title: title.trim(), topic: topic.trim() || undefined, description: description.trim() || undefined,
      criteria: criteria.trim(), visibility, deadline: deadline || null,
      mode, location: mode === 'in_person' ? location.trim() : undefined,
      starts_at: mode === 'online' && startsAt ? new Date(startsAt).toISOString() : null,
    })
    setLoading(false)
    if (createError) return setError(createError.message)
    setTitle(''); setTopic(''); setDescription(''); setCriteria(''); setDeadline(''); setLocation(''); setStartsAt('')
    onCreated()
  }

  return (
    <div className="bg-surface-subtle border border-edge-subtle rounded-xl p-5 mb-5">
      <ErrorBanner message={error} />
      <TextField label="Title" value={title} onChange={setTitle} placeholder={type === 'course' ? 'Intro to Web Development' : 'Design a mobile app icon'} autoFocus />
      <TextField label="Topic / subject (optional)" value={topic} onChange={setTopic} placeholder={type === 'course' ? 'e.g. Web Development' : 'e.g. Graphic Design'} />
      <TextField label="Description" value={description} onChange={setDescription} placeholder="What will students learn or do?" />
      <TextField
        label="Criteria — what success looks like"
        value={criteria} onChange={setCriteria}
        placeholder="e.g. Original, scalable to 16px, with a one-paragraph rationale"
        hint="Visible to students too. This is what a tutor checks the work against when they verify it."
      />
      <label className="block mb-4">
        <span className="block text-[13px] font-semibold text-ink mb-1.5">Deadline (optional)</span>
        <input
          type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
          className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition"
        />
      </label>
      <label className="block mb-4">
        <span className="block text-[13px] font-semibold text-ink mb-1.5">Where</span>
        <div className="flex gap-2 mb-2">
          {(['online', 'in_person'] as const).map(m => (
            <button
              key={m} type="button" onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition ${
                mode === m ? 'bg-brand text-white' : 'bg-surface border border-edge text-ink-secondary'
              }`}
            >
              {m === 'online' ? 'Online' : 'In person'}
            </button>
          ))}
        </div>
        {mode === 'in_person' ? (
          <input
            value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Room 4B, main campus"
            className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
          />
        ) : (
          <>
            <p className="text-[12px] text-ink-tertiary mb-2">A live video room is created automatically — everyone joins from the {type} card.</p>
            <span className="block text-[12px] font-semibold text-ink-secondary mb-1">Starts at (optional)</span>
            <input
              type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)}
              className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition"
            />
            <p className="text-[11px] text-ink-tertiary mt-1">Students won't see a join button until this time. Leave blank to make it joinable right away.</p>
          </>
        )}
      </label>
      <label className="block mb-5">
        <span className="block text-[13px] font-semibold text-ink mb-1.5">Visibility</span>
        <div className="flex gap-2">
          {(['private', 'public'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold capitalize transition ${
                visibility === v ? 'bg-brand text-white' : 'bg-surface border border-edge text-ink-secondary'
              }`}
            >
              {v === 'private' ? 'Private — join code only' : 'Public'}
            </button>
          ))}
        </div>
      </label>
      <PrimaryButton onClick={handleSubmit} loading={loading}>Create</PrimaryButton>
    </div>
  )
}

// Briefs' "two ways": set a new brief, or upload coursework/exam work a
// group already produced elsewhere and mark it for verification directly
// — no new marking, straight into the review queue.
// A real modal dialog now, not an inline card in the page flow -- the
// Classroom create dialog it's borrowing the shape from is a focused
// document/sidebar split (big title + instructions on the left, the
// metadata that governs it — topic, criteria, deadline, class, publish
// state — grouped in a panel on the right), not one long stacked form.
// Same fields as before, same "verify, not grade" content, just laid
// out like the thing it's meant to feel as considered as.
type PublishChoice = 'posted' | 'draft' | 'scheduled'

function NewBriefForm({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [assignment, setAssignment] = useState('')
  const [criteria, setCriteria] = useState('')
  const [deadline, setDeadline] = useState('')
  const [groupId, setGroupId] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [files, setFiles] = useState<File[]>([])
  const [publishChoice, setPublishChoice] = useState<PublishChoice>('posted')
  const [scheduledFor, setScheduledFor] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) return setError('Give it a title.')
    if (!assignment.trim()) return setError('Write what the student has to do.')
    if (!criteria.trim()) return setError('Success criteria is required — this is what makes the tick mean something.')
    if (publishChoice === 'scheduled' && !scheduledFor) return setError('Pick a date and time to schedule it for.')
    if (publishChoice === 'scheduled' && new Date(scheduledFor) <= new Date()) return setError('Scheduled time has to be in the future — otherwise just post it now.')
    if (!user?.organisation_id) return setError("Your account isn't linked to an organisation yet — try refreshing the page.")

    setLoading(true)
    const { data: workItem, error: createError } = await createWorkItem(user.organisation_id, user.id, {
      type: 'brief', title: title.trim(), topic: topic.trim() || undefined, assignment: assignment.trim(),
      criteria: criteria.trim(), deadline: deadline || null, group_id: groupId || null, visibility,
      publish_state: publishChoice,
      scheduled_for: publishChoice === 'scheduled' ? new Date(scheduledFor).toISOString() : null,
    })
    if (createError || !workItem) { setLoading(false); return setError(createError?.message || 'Could not create the brief.') }

    for (const file of files) {
      const { error: attachError } = await uploadWorkItemAttachment((workItem as any).id, user.id, file)
      if (attachError) { setLoading(false); return setError(`Brief created, but "${file.name}" failed to attach: ${attachError.message}`) }
    }
    setLoading(false)
    onCreated()
  }

  return createPortal((
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-8">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge-subtle flex-shrink-0">
          <p className="font-bold text-ink text-[16px]">New brief</p>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-tertiary transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1fr_300px] divide-y lg:divide-y-0 lg:divide-x divide-edge-subtle">
          {/* ── Main: title + instructions + attachments ── */}
          <div className="px-6 py-5">
            <input
              value={title} onChange={e => setTitle(e.target.value)} autoFocus
              placeholder="Untitled brief"
              className="w-full text-2xl font-bold text-ink placeholder-ink-quaternary outline-none bg-transparent border-b border-transparent focus:border-edge pb-2 mb-5 transition"
            />
            <label className="block mb-4">
              <span className="block text-[13px] font-semibold text-ink mb-1.5">Instructions — what the student has to do</span>
              <textarea
                value={assignment} onChange={e => setAssignment(e.target.value)}
                placeholder="Write the full instructions here — as much room as you need."
                rows={10}
                className="w-full bg-surface-subtle border border-edge rounded-xl px-4 py-3 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand focus:bg-surface transition resize-none leading-relaxed"
              />
            </label>
            <label className="block mb-1.5">
              <span className="block text-[13px] font-semibold text-ink mb-1.5">Attachments (optional)</span>
            </label>
            <FileDropzone files={files} onChange={setFiles} multiple />
          </div>

          {/* ── Sidebar: everything that governs the brief ── */}
          <div className="px-5 py-5 bg-surface-subtle/60 space-y-5">
            <TextField label="Topic" value={topic} onChange={setTopic} placeholder="e.g. Graphic Design" hint="Groups briefs together, like a Classroom topic." />
            <TextField
              label="Criteria — what makes it a verify" value={criteria} onChange={setCriteria}
              placeholder="e.g. Original, scalable to 16px, with a one-paragraph rationale"
              hint="Visible to the student too. LERN's replacement for a rubric — not a mark out of ten."
            />
            <label className="block">
              <span className="block text-[13px] font-semibold text-ink mb-1.5">Deadline (optional)</span>
              <input
                type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition"
              />
            </label>
            <GroupPicker organisationId={user?.organisation_id} value={groupId} onChange={setGroupId} />
            <label className="block">
              <span className="block text-[13px] font-semibold text-ink mb-1.5">Visibility</span>
              <div className="flex gap-2">
                {(['private', 'public'] as const).map(v => (
                  <button
                    key={v} type="button" onClick={() => setVisibility(v)}
                    className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold capitalize transition ${
                      visibility === v ? 'bg-brand text-white' : 'bg-surface border border-edge text-ink-secondary'
                    }`}
                  >
                    {v === 'private' ? 'Private' : 'Public'}
                  </button>
                ))}
              </div>
            </label>
            <label className="block">
              <span className="block text-[13px] font-semibold text-ink mb-1.5">When</span>
              <div className="flex flex-col gap-1.5">
                {([['posted', 'Post now'], ['draft', 'Save as draft'], ['scheduled', 'Schedule']] as [PublishChoice, string][]).map(([choice, label]) => (
                  <button
                    key={choice} type="button" onClick={() => setPublishChoice(choice)}
                    className={`w-full text-left py-2.5 px-3 rounded-lg text-[13px] font-semibold transition ${
                      publishChoice === choice ? 'bg-brand text-white' : 'bg-surface border border-edge text-ink-secondary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {publishChoice === 'draft' && (
                <p className="text-[12px] text-ink-tertiary mt-2">Only staff can see a draft. Come back and post it whenever it's ready.</p>
              )}
              {publishChoice === 'scheduled' && (
                <input
                  type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)}
                  className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition mt-2"
                />
              )}
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-edge-subtle flex-shrink-0">
          <div className="flex-1 min-w-0">
            {error && <p className="text-[13px] font-semibold text-danger-text">{error}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-ink-secondary hover:bg-surface-muted transition">
              Cancel
            </button>
            {/* Not the shared PrimaryButton here -- it's w-full, built
                for standing alone as a full-width submit button (as it
                is everywhere else it's used). Reused inline next to
                Cancel in this compact flex-shrink-0 row, that w-full
                fights the row's own shrink-to-fit sizing -- the button
                stretched to fill leftover flex space instead of sizing
                to its own label, which read as "doesn't fit in the
                box." A plain auto-width button, sized like Cancel next
                to it, is what this spot actually needs. */}
            <button
              onClick={handleSubmit} disabled={loading}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-white text-[13px] font-bold hover:bg-brand-hover active:scale-[0.99] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading && <Spinner />}
              {publishChoice === 'draft' ? 'Save draft' : publishChoice === 'scheduled' ? 'Schedule' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  ), document.body)
}

function UploadExistingWorkForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [criteria, setCriteria] = useState('')
  const [groupId, setGroupId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) return setError('Give it a title.')
    if (!criteria.trim()) return setError('Criteria is required — this is what makes the tick mean something.')
    if (!groupId) return setError('Choose which class/group this work belongs to.')
    if (files.length === 0) return setError('Attach the existing work — drag it in or choose a file.')
    if (!user?.organisation_id) return setError("Your account isn't linked to an organisation yet — try refreshing the page.")

    setLoading(true)
    const { data: members, error: membersError } = await getGroupMembers(groupId)
    if (membersError || !members || members.length === 0) {
      setLoading(false)
      return setError('That group has no students in it yet.')
    }

    const { data: workItem, error: createError } = await createWorkItem(user.organisation_id, user.id, {
      type: 'brief', title: title.trim(), topic: topic.trim() || undefined,
      criteria: criteria.trim(), group_id: groupId, visibility: 'private',
    })
    if (createError || !workItem) { setLoading(false); return setError(createError?.message || 'Could not create the brief.') }

    const file = files[0]
    for (const member of members) {
      const { path, error: uploadError } = await uploadSubmissionFileFor(member.id, file)
      if (uploadError || !path) { setLoading(false); return setError(`Brief created, but uploading for ${member.full_name} failed: ${uploadError?.message}`); }
      const { error: submitError } = await submitWorkForStudents([member.id], (workItem as any).id, '', { path, type: file.type, size: file.size })
      if (submitError) { setLoading(false); return setError(`Brief created, but marking ${member.full_name}'s work failed: ${submitError.message}`) }
    }
    setLoading(false)
    setTitle(''); setTopic(''); setCriteria(''); setGroupId(''); setFiles([])
    onCreated()
  }

  return (
    <div className="bg-surface-subtle border border-edge-subtle rounded-xl p-5">
      <ErrorBanner message={error} />
      <TextField label="Title" value={title} onChange={setTitle} placeholder="Year 11 Coursework — Unit 3" autoFocus />
      <TextField label="Topic / subject" value={topic} onChange={setTopic} placeholder="e.g. GCSE Photography" />
      <label className="block mb-1.5">
        <span className="block text-[13px] font-semibold text-ink mb-1.5">The existing work</span>
      </label>
      <FileDropzone files={files} onChange={setFiles} />
      <TextField
        label="Success criteria" value={criteria} onChange={setCriteria}
        placeholder="e.g. Meets the exam board's grade 5+ descriptor"
        hint="What a tutor checks the existing work against when they verify it."
      />
      <GroupPicker organisationId={user?.organisation_id} value={groupId} onChange={setGroupId} required />
      <p className="text-[12px] text-ink-tertiary mb-4">This already happened outside LERN — no new marking, just verification. Every student currently in the group gets this marked as their submission, ready to review.</p>
      <PrimaryButton onClick={handleSubmit} loading={loading}>Create and send to review</PrimaryButton>
    </div>
  )
}
