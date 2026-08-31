'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getVisibleWorkItems, getMySubmissions, getMyOrgType, getWorkItemMemberCount,
  submitWork, uploadSubmissionFile, getSignedFileUrl, redeemJoinCode,
} from '@/lib/supabase'
import type { WorkItem } from '@/lib/types'
import {
  Clock, Users, BadgeCheck, Paperclip, X, Video, MapPin, CalendarClock,
  CheckCircle2, RotateCcw, KeyRound, ArrowLeft,
} from 'lucide-react'
import WorkshopSession from '@/components/v2/WorkshopSession'

// Student My Work — three tabs, learner-type dependent. Sizes/structure
// pulled directly from the actual deleted v1 app/courses/page.tsx (git
// show a07a8c2~1), not eyeballed: no header above the tabs at all (that
// lives on Feed only), text-sm tabs, fixed 200/190px image blocks (not
// aspect-ratio), 10px pills, 15px titles, text-sm/text-xs body copy.
// Held to three tabs on purpose (a phone tab bar gets cluttered past
// that): institution students get Briefs/Assignments/Workshops,
// provider students get Courses/Assignments/Workshops. No "Enrol" tab —
// every item visible here is already the student's own org's, linked
// automatically through their join code, nothing to browse/opt into.
//
// Tapping a card opens a full-screen detail view (like tapping a
// YouTube thumbnail opens the player) rather than expanding in place.

type Tab = 'primary' | 'assignment' | 'workshop'

const GRADIENTS = [
  'from-[#2E6F9E] to-[#173C57]',
  'from-[#5B2A86] to-[#1E0F30]',
  'from-[#1E7A5E] to-[#0C3327]',
  'from-[#8A3B5C] to-[#301122]',
]
function bannerGradient(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return GRADIENTS[Math.abs(h) % GRADIENTS.length]
}
function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-white/10 text-white' },
  submitted: { label: 'Submitted', cls: 'bg-[#3a2e14] text-[#e0b64a]' },
  returned: { label: 'Returned', cls: 'bg-[#3a1e14] text-[#e08a4a]' },
  verified: { label: 'Completed', cls: 'bg-[#123a24] text-[#4ade80]' },
  revoked: { label: 'Revoked', cls: 'bg-[#3a1414] text-[#e04a4a]' },
}

export default function StudentMyWorkPanel() {
  const { user, refreshUser } = useAuth()
  const [orgType, setOrgType] = useState<'institution' | 'provider' | null>(null)
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('primary')
  const [selected, setSelected] = useState<WorkItem | null>(null)

  const load = () => {
    if (!user?.organisation_id) return
    Promise.all([
      getMyOrgType(),
      getVisibleWorkItems(user.organisation_id),
      getMySubmissions(user.id),
    ]).then(([ot, wi, subs]) => {
      setOrgType(ot)
      // A workshop is one live session -- once it's ended there's
      // nothing left to join, so (matching the staff side's own
      // WorkItemsPanel) it drops out of the active list the instant
      // ended_at is set, not just once the badge says "Ended". It's
      // still visible from the Dashboard's "Previous workshops" card.
      // Courses aren't dropped the same way -- a course can genuinely
      // run for months, so ended_at isn't "nothing left here" the same
      // way it is for a single workshop session.
      setWorkItems((wi.data || []).filter((w: any) => !w.closed_at && !(w.type === 'workshop' && w.ended_at)))
      setSubmissions(subs.data || [])
      setLoading(false)
    })
  }
  useEffect(load, [user?.organisation_id, user?.id])

  if (!user?.organisation_id) return <JoinCodePrompt onJoined={refreshUser} />
  if (loading || !orgType) {
    return (
      <div className="p-4 space-y-3">
        {[0, 1].map(i => <div key={i} className="h-52 rounded-2xl bg-[#1a1a1a] animate-pulse" />)}
      </div>
    )
  }

  const primaryType = orgType === 'institution' ? 'brief' : 'course'
  const primaryLabel = orgType === 'institution' ? 'Briefs' : 'Courses'
  const items = workItems.filter(w => {
    if (tab === 'primary') return w.type === primaryType
    if (tab === 'assignment') return w.type === 'assignment'
    return w.type === 'workshop'
  })
  const selectedSubs = selected ? submissions.filter((s: any) => s.work_item_id === selected.id) : []

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-stretch border-b border-white/[0.07] bg-[#0f0f0f]">
        <TabButton active={tab === 'primary'} label={primaryLabel} onClick={() => setTab('primary')} />
        <TabButton active={tab === 'assignment'} label="Assignments" onClick={() => setTab('assignment')} />
        <TabButton active={tab === 'workshop'} label="Workshops" onClick={() => setTab('workshop')} />
      </div>

      <div className="px-4 pt-3 pb-1">
        <span className="text-[13px] font-semibold text-[#666]">{items.length} {items.length === 1 ? tab === 'primary' ? primaryLabel.slice(0, -1).toLowerCase() : tab : tab === 'primary' ? primaryLabel.toLowerCase() : `${tab}s`}</span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 px-6">
          <p className="font-bold text-white text-[15px] mb-1">Nothing here yet</p>
          <p className="text-sm text-[#666]">Check back once your organisation posts something.</p>
        </div>
      ) : (
        <div className="px-4 py-3 space-y-3">
          {items.map(item => {
            const mySubs = submissions.filter((s: any) => s.work_item_id === item.id)
            return <WorkCard key={item.id} item={item} latest={mySubs[0]} onOpen={() => setSelected(item)} />
          })}
        </div>
      )}

      {selected && (
        <WorkItemDetail
          item={selected}
          latest={selectedSubs[0]}
          allSubs={selectedSubs}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3.5 text-sm font-semibold border-b-2 transition ${active ? 'text-white border-white' : 'text-[#555] border-transparent'}`}
    >
      {label}
    </button>
  )
}

function WorkCard({ item, latest, onOpen }: { item: WorkItem; latest: any; onOpen: () => void }) {
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const hostName = (item as any).users?.full_name

  useEffect(() => {
    if (item.type === 'course' || item.type === 'workshop') getWorkItemMemberCount(item.id).then(setMemberCount)
  }, [item.id, item.type])

  const isSubmittable = item.type === 'brief' || item.type === 'assignment'
  const statusKey = latest ? latest.status : 'new'
  const status = STATUS[statusKey]
  const live = !!item.started_at && !item.ended_at
  const ended = !!item.ended_at
  const imgHeight = item.type === 'workshop' ? 190 : 200

  return (
    <button onClick={onOpen} className="block w-full text-left bg-[#1a1a1a] rounded-2xl overflow-hidden border border-white/[0.06]">
      <div className={`relative bg-gradient-to-br ${bannerGradient(item.id)} flex items-center justify-center`} style={{ height: imgHeight }}>
        <span className="text-white/10 font-black text-4xl tracking-tight select-none">LERN</span>

        {isSubmittable ? (
          <>
            <span className="absolute top-2.5 left-2.5 text-[10px] font-bold bg-black/80 text-white px-2.5 py-1 rounded-full uppercase tracking-wide">
              {item.topic || item.type}
            </span>
            <span className={`absolute top-2.5 right-2.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${status.cls}`}>
              {status.label}
            </span>
          </>
        ) : (
          <>
            <span className="absolute top-2.5 left-2.5 text-[10px] font-bold bg-black/80 text-white px-2.5 py-1 rounded-full uppercase tracking-wide">
              {[item.topic, item.level].filter(Boolean).join(' · ') || item.type}
            </span>
            {item.type === 'course' && (
              <span className="absolute top-2.5 right-2.5 text-[10px] font-bold bg-[#FF6B2B] text-white px-2.5 py-1 rounded-full">YOUR COURSE</span>
            )}
            {item.type === 'workshop' && (
              live ? (
                <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 bg-red-500/90 rounded-full px-2.5 py-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-[10px] font-bold">LIVE NOW</span>
                </div>
              ) : (
                <span className={`absolute top-2.5 right-2.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${ended ? 'bg-black/80 text-white/60' : 'bg-[#FF6B2B]/90 text-white'}`}>
                  {ended ? 'Ended' : (item.mode || 'online')}
                </span>
              )
            )}
          </>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-white font-bold text-[15px] leading-snug line-clamp-2 mb-2">{item.title}</h3>
        {item.description && <p className="text-[#777] text-sm line-clamp-2 mb-3 leading-snug">{item.description}</p>}

        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#3A2E24] to-[#241C15] flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
            {initials(hostName)}
          </div>
          <span className="text-white text-sm font-semibold flex items-center gap-1">
            {hostName || 'Your organisation'}
            <BadgeCheck className="w-3.5 h-3.5 text-[#4a9de0]" />
          </span>
        </div>

        <div className="flex items-center gap-4 text-[#666] text-xs mb-4">
          {isSubmittable ? (
            item.deadline && (
              <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Due {new Date(item.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            )
          ) : (
            <>
              {(item.duration_label || item.starts_at) && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.starts_at ? `Starts ${new Date(item.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                  {item.starts_at && item.duration_label ? ' · ' : ''}
                  {item.duration_label || ''}
                </span>
              )}
              {memberCount !== null && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {memberCount} joined</span>}
            </>
          )}
        </div>

        <div className={`w-full text-center rounded-2xl py-3 text-sm font-bold ${
          item.type === 'workshop' || item.type === 'course'
            ? live ? 'bg-red-500 text-white' : 'bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white'
            : statusKey === 'verified' ? 'bg-[#123a24] text-[#4ade80]'
            : statusKey === 'submitted' ? 'bg-white/10 text-white/70'
            : 'bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white'
        }`}>
          {item.type === 'workshop' || item.type === 'course'
            ? live ? '🔴 Join Now' : ended ? 'Ended' : 'Start Class →'
            : statusKey === 'verified' ? 'Completed ✓'
            : statusKey === 'submitted' ? 'Awaiting review'
            : statusKey === 'returned' ? 'Resubmit →'
            : 'Open →'}
        </div>
      </div>
    </button>
  )
}

// Full-screen detail — the "tap the thumbnail, it opens and plays"
// screen. Covers the whole viewport (its own header with a back
// arrow) rather than expanding the card in place.
function WorkItemDetail({
  item, latest, allSubs, onClose, onChanged,
}: { item: WorkItem; latest: any; allSubs: any[]; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [inSession, setInSession] = useState(false)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const hostName = (item as any).users?.full_name
  const canSubmit = (item.type === 'brief' || item.type === 'assignment') && (!latest || latest.status === 'returned')

  useEffect(() => {
    if (item.type === 'course' || item.type === 'workshop') getWorkItemMemberCount(item.id).then(setMemberCount)
  }, [item.id, item.type])

  const handleSubmit = async () => {
    setError('')
    if (!content.trim() && !file) return setError('Write, link, or attach your work before submitting.')
    if (!user) return
    setLoading(true)
    let fileInfo: { path: string; type: string; size: number } | undefined
    if (file) {
      const { path, error: uploadError } = await uploadSubmissionFile(user.id, file)
      if (uploadError || !path) { setLoading(false); return setError(uploadError?.message || 'File upload failed.') }
      fileInfo = { path, type: file.type, size: file.size }
    }
    const { error: submitError } = await submitWork(user.id, item.id, content.trim(), fileInfo)
    setLoading(false)
    if (submitError) return setError(submitError.message)
    setContent(''); setFile(null)
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f0f] overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 h-14 px-3 bg-[#0f0f0f]/95 backdrop-blur border-b border-white/10">
        <button onClick={onClose} aria-label="Back" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-white text-[15px] truncate">{item.title}</span>
      </div>

      <div className={`h-[200px] bg-gradient-to-br ${bannerGradient(item.id)} flex items-center justify-center`}>
        <span className="text-white/10 font-black text-5xl tracking-tight select-none">LERN</span>
      </div>

      <div className="p-4">
        <h1 className="font-bold text-white text-xl leading-snug mb-2">{item.title}</h1>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#3A2E24] to-[#241C15] flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
            {initials(hostName)}
          </div>
          <span className="text-white text-sm font-semibold flex items-center gap-1">
            {hostName || 'Your organisation'}
            <BadgeCheck className="w-3.5 h-3.5 text-[#4a9de0]" />
          </span>
        </div>

        {item.description && <p className="text-[#999] text-sm leading-snug mb-4">{item.description}</p>}

        <div className="flex items-center gap-4 text-[#666] text-xs mb-4">
          {item.type === 'brief' || item.type === 'assignment' ? (
            item.deadline && <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Due {new Date(item.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          ) : (
            <>
              {item.starts_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Starts {new Date(item.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{item.duration_label ? ` · ${item.duration_label}` : ''}</span>}
              {memberCount !== null && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {memberCount} joined</span>}
            </>
          )}
        </div>

        <p className="text-[11px] font-bold text-[#666] uppercase tracking-wide mb-1.5">
          {item.type === 'assignment' ? 'Assignment' : 'Criteria'}
        </p>
        <p className="text-sm text-[#ccc] mb-4 leading-snug">{item.assignment || item.criteria}</p>

        {(item.type === 'workshop' || item.type === 'course') && (
          <div className="mb-4">
            {item.ended_at ? (
              <span className="inline-flex items-center gap-1.5 bg-white/10 text-[#999] font-semibold text-sm px-4 py-2.5 rounded-lg"><Video className="w-4 h-4" /> Ended</span>
            ) : item.mode === 'online' && !item.started_at && item.starts_at && new Date(item.starts_at) > new Date() ? (
              <p className="flex items-center gap-1.5 text-sm text-[#aaa]">
                <CalendarClock className="w-4 h-4" /> Starts {new Date(item.starts_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} — join opens once it's started.
              </p>
            ) : item.mode === 'online' ? (
              <button onClick={() => setInSession(true)} className="flex items-center gap-2 bg-red-500 text-white font-bold text-sm px-5 py-3 rounded-2xl">
                <Video className="w-4 h-4" /> Join session
              </button>
            ) : item.location && (
              <p className="flex items-center gap-1.5 text-sm text-[#aaa]"><MapPin className="w-4 h-4" /> {item.location}</p>
            )}
          </div>
        )}
        {inSession && <WorkshopSession workItemId={item.id} title={item.title} onClose={() => setInSession(false)} />}

        {allSubs.length > 0 && (
          <div className="space-y-2 mb-4">
            {allSubs.map((s: any) => <SubmissionRow key={s.id} submission={s} />)}
          </div>
        )}

        {canSubmit && (
          <>
            {error && <p className="text-xs text-[#e04a4a] mb-2">{error}</p>}
            <textarea
              value={content} onChange={e => setContent(e.target.value)}
              placeholder="Paste a link, or write your work here."
              rows={5}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-[#666] outline-none focus:border-white/30 transition mb-3 resize-none"
            />
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-xs font-semibold text-[#aaa] mb-3">
              <Paperclip className="w-3.5 h-3.5" /> {file ? file.name : 'Attach a file (optional)'}
              {file && <span onClick={e => { e.stopPropagation(); setFile(null) }} className="hover:text-[#e04a4a]"><X className="w-3.5 h-3.5" /></span>}
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            <button onClick={handleSubmit} disabled={loading} className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold text-sm py-3 rounded-2xl disabled:opacity-60">
              {loading ? 'Submitting…' : latest?.status === 'returned' ? 'Resubmit' : 'Submit work'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function SubmissionRow({ submission }: { submission: any }) {
  const status = STATUS[submission.status]
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  useEffect(() => {
    if (submission.file_path) getSignedFileUrl('submission-files', submission.file_path).then(({ url }) => setFileUrl(url))
  }, [submission.file_path])

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
        <span className="text-[11px] text-[#666]">{new Date(submission.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
      </div>
      {submission.content && <p className="text-sm text-[#ccc] whitespace-pre-wrap mb-1 leading-snug">{submission.content}</p>}
      {submission.file_path && (
        <a href={fileUrl || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-[#4a9de0] hover:underline mb-1">
          <Paperclip className="w-3 h-3" /> {submission.file_path.split('/').pop()}
        </a>
      )}
      {submission.status === 'verified' && (
        <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[11px] text-[#4ade80]">
          <CheckCircle2 className="w-3.5 h-3.5" /> Verified {submission.verifications?.[0]?.verified_at ? new Date(submission.verifications[0].verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
        </div>
      )}
      {submission.status === 'returned' && (
        <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[11px] text-[#e08a4a]"><RotateCcw className="w-3.5 h-3.5" /> Returned — resubmit above</div>
      )}
    </div>
  )
}

function JoinCodePrompt({ onJoined }: { onJoined: () => Promise<void> }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoin = async () => {
    setError('')
    if (!code.trim()) return setError('Enter your join code.')
    setLoading(true)
    const { error: redeemError } = await redeemJoinCode(code)
    if (redeemError) { setLoading(false); return setError('That code isn’t valid, has expired, or has been revoked. Check it with your school, college or provider.') }
    await onJoined()
    setLoading(false)
  }

  return (
    <div className="px-4 py-10">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 text-center">
        <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-5 h-5 text-white" />
        </div>
        <p className="font-bold text-white text-[16px] mb-1.5">You're not linked to an organisation yet</p>
        <p className="text-sm text-[#999] mb-5 leading-snug">
          Enter the code your school, college or training provider gave you to unlock briefs, courses, and submitting your own work.
        </p>
        {error && <p className="text-xs text-[#e04a4a] mb-3">{error}</p>}
        <input
          value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. 7K3P9XQZ"
          className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-[#666] text-center tracking-widest font-bold outline-none focus:border-white/30 mb-3"
        />
        <button onClick={handleJoin} disabled={loading} className="w-full bg-white text-black font-bold text-sm py-3 rounded-xl disabled:opacity-60">
          {loading ? 'Joining…' : 'Join'}
        </button>
      </div>
    </div>
  )
}
