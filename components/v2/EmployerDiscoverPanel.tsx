'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getDiscoverWork, getMyInterest, expressInterest, getDiscoverSkillNames,
  getTalentPools, createTalentPool, addToTalentPool, removeFromTalentPool, getPoolMembershipsForStudents, getEmployerBilling,
} from '@/lib/supabase'
import { EMPLOYER_TIERS, type EmployerTier } from '@/lib/billing'
import { BadgeCheck, Search, Send, Check, Clock, Shield, Bookmark, Plus, X } from 'lucide-react'

type WorkType = 'all' | 'brief' | 'course' | 'workshop'

const TYPE_LABEL: Record<string, string> = { brief: 'Brief', course: 'Course', workshop: 'Workshop' }

// One "folder" per student, not one card per piece of work -- a
// student with 3 verified pieces used to show as 3 disconnected cards
// with no way to see their full picture without already knowing to
// click into one first. Groups the same getDiscoverWork rows client
// side (no new query needed), newest-first within each folder.
function groupByStudent(items: any[]) {
  const byId = new Map<string, { student: any; pieces: any[]; latest: any }>()
  for (const v of items) {
    const student = v.submissions?.student
    if (!student) continue
    const existing = byId.get(student.id)
    if (existing) {
      existing.pieces.push(v)
      if (new Date(v.verified_at) > new Date(existing.latest.verified_at)) existing.latest = v
    } else {
      byId.set(student.id, { student, pieces: [v], latest: v })
    }
  }
  return Array.from(byId.values()).sort((a, b) => new Date(b.latest.verified_at).getTime() - new Date(a.latest.verified_at).getTime())
}

// Every row this queries is either work an 18+ student chose to make
// public themselves, OR a specific piece their institution has
// explicitly flagged employer-visible on their behalf (the only path
// for under-18 students, who can't self-toggle 'public' at all) --
// both enforced in the database (RLS + submission_visible_to_employer/
// work_item_visible_to_employer), not here. Either way, this never
// means literally public: it's gated to vetted employer accounts only.
// "Express interest" never gives an employer contact details — it
// only ever inserts a row that's routed to the student's organisation.
export default function EmployerDiscoverPanel() {
  const { user } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<WorkType>('all')
  const [q, setQ] = useState('')
  const [skill, setSkill] = useState('')
  const [skillOptions, setSkillOptions] = useState<string[]>([])
  const [interestByStudent, setInterestByStudent] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [composer, setComposer] = useState<{ studentId: string; studentName: string; label?: string } | null>(null)
  const [pools, setPools] = useState<any[]>([])
  const [tier, setTier] = useState<EmployerTier>('micro')
  const [savePopoverFor, setSavePopoverFor] = useState<{ id: string; name: string } | null>(null)
  const [membershipsByStudent, setMembershipsByStudent] = useState<Record<string, { id: string; pool_id: string }[]>>({})

  const loadPools = () => {
    if (!user) return
    Promise.all([getTalentPools(user.id), getEmployerBilling(user.id)]).then(([poolsRes, billingRes]) => {
      setPools(poolsRes.data || [])
      if (billingRes.data?.tier) setTier(billingRes.data.tier)
    })
  }
  useEffect(loadPools, [user?.id])

  const load = () => {
    setLoading(true)
    getDiscoverWork({ type: type === 'all' ? undefined : type, q: q.trim() || undefined, skill: skill || undefined }).then(({ data }) => {
      setItems(data || [])
      setLoading(false)
      const studentIds = Array.from(new Set((data || []).map((v: any) => v.submissions?.student?.id).filter(Boolean)))
      getPoolMembershipsForStudents(studentIds).then(({ data: rows }) => {
        const map: Record<string, { id: string; pool_id: string }[]> = {}
        for (const r of rows) (map[r.student_id] ??= []).push({ id: r.id, pool_id: r.pool_id })
        setMembershipsByStudent(map)
      })
    })
  }
  useEffect(load, [type, skill])
  useEffect(() => { getDiscoverSkillNames().then(({ data }) => setSkillOptions(data)) }, [])

  useEffect(() => {
    if (!user) return
    getMyInterest(user.id).then(({ data }) => {
      const map: Record<string, string> = {}
      for (const i of data || []) map[i.student_id] = i.status
      setInterestByStudent(map)
    })
  }, [user])

  const [composerError, setComposerError] = useState('')
  const handleExpress = async (message: string) => {
    if (!user || !composer) return
    setSending(composer.studentId); setComposerError('')
    const { error } = await expressInterest(user.id, composer.studentId, { message, opportunity_label: composer.label })
    setSending(null)
    if (error) { setComposerError(error.message || "Couldn't send — try again."); return }
    setInterestByStudent(prev => ({ ...prev, [composer.studentId]: 'pending' })); setComposer(null)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">Discover</h1>
        <p className="text-ink-tertiary text-[14px]">Verified work students have chosen to make public. Interest is always routed through their organisation.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} onBlur={load}
            placeholder="Search by title or description…"
            className="w-full bg-surface border border-edge rounded-xl pl-9 pr-3 py-2.5 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
          />
        </div>
        <div className="flex gap-1 bg-surface-muted rounded-xl p-1 flex-shrink-0">
          {(['all', 'brief', 'course', 'workshop'] as WorkType[]).map(t => (
            <button
              key={t} onClick={() => setType(t)}
              className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold capitalize transition ${
                type === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-tertiary hover:text-ink'
              }`}
            >
              {t === 'all' ? 'All' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        {skillOptions.length > 0 && (
          <select
            value={skill} onChange={e => setSkill(e.target.value)}
            className="bg-surface border border-edge rounded-xl px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition flex-shrink-0"
          >
            <option value="">Any skill</option>
            {skillOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl p-10 text-center">
          <p className="font-bold text-ink text-[15px] mb-1.5">Nothing here yet</p>
          <p className="text-ink-tertiary text-[14px]">No public verified work matches this search yet — check back soon.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {groupByStudent(items).map(folder => {
            const { student, pieces, latest } = folder
            const status = interestByStudent[student.id]
            const wi = latest.submissions?.work_items
            return (
              <div key={student.id} className="bg-surface border border-edge rounded-2xl p-5 flex flex-col">
                <button
                  className="flex-1 min-w-0 text-left hover:opacity-80 transition mb-3"
                  onClick={() => router.push(`/employer/discover/${student.id}`)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">
                      {pieces.length} verified {pieces.length === 1 ? 'piece' : 'pieces'} of work
                    </span>
                    <span className="flex items-center gap-1 text-[12px] font-semibold text-success-text flex-shrink-0">
                      <BadgeCheck className="w-3.5 h-3.5" /> Verified
                    </span>
                  </div>
                  <p className="font-bold text-ink text-[16px] mb-1">{student.full_name || 'Student'}</p>
                  <p className="text-[13px] text-ink-tertiary mb-1">
                    Most recent: {wi?.title} ({TYPE_LABEL[wi?.type] || wi?.type})
                  </p>
                  {student.bio && <p className="text-[12.5px] text-ink-secondary line-clamp-2 mt-1.5">{student.bio}</p>}
                </button>

                <div className="mt-auto pt-3 border-t border-edge-subtle flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSavePopoverFor({ id: student.id, name: student.full_name || 'this student' })}
                    aria-label="Save to a talent pool"
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition flex-shrink-0 ${
                      (membershipsByStudent[student.id]?.length ?? 0) > 0
                        ? 'text-brand bg-brand/10 hover:bg-brand/15'
                        : 'text-ink-tertiary hover:text-ink hover:bg-surface-muted'
                    }`}
                  >
                    <Bookmark className="w-4 h-4" fill={(membershipsByStudent[student.id]?.length ?? 0) > 0 ? 'currentColor' : 'none'} />
                  </button>
                  {status === 'pending' ? (
                    <span className="flex items-center gap-1 text-[12px] font-semibold text-warning-text flex-shrink-0"><Clock className="w-3.5 h-3.5" /> Pending</span>
                  ) : status === 'accepted' ? (
                    <span className="flex items-center gap-1 text-[12px] font-semibold text-success-text flex-shrink-0"><Check className="w-3.5 h-3.5" /> Accepted</span>
                  ) : status === 'declined' ? (
                    <span className="text-[12px] font-semibold text-ink-tertiary flex-shrink-0">Declined</span>
                  ) : (
                    <button
                      onClick={() => setComposer({ studentId: student.id, studentName: student.full_name || 'this student', label: wi?.title })}
                      disabled={sending === student.id}
                      className="flex items-center gap-1.5 bg-brand text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 flex-shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" /> {sending === student.id ? 'Sending…' : 'Express interest'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-lg px-[13px] py-[10px] flex items-start gap-2" style={{ backgroundColor: '#E1F5EE' }}>
          <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#0F6E56' }} />
          <p className="text-[12px]" style={{ color: '#0F6E56' }}>
            Under-18s are not publicly searchable as people. You express interest, and it routes through their school.
          </p>
        </div>
      )}

      {composer && (
        <OfferComposer
          studentName={composer.studentName}
          sending={sending === composer.studentId}
          error={composerError}
          onClose={() => setComposer(null)}
          onSend={handleExpress}
        />
      )}

      {savePopoverFor && (
        <SaveToPoolPopover
          studentName={savePopoverFor.name}
          pools={pools}
          tier={tier}
          memberships={membershipsByStudent[savePopoverFor.id] || []}
          onToggle={async (pool, membership) => {
            if (membership) {
              await removeFromTalentPool(membership.id)
              setMembershipsByStudent(prev => ({ ...prev, [savePopoverFor.id]: (prev[savePopoverFor.id] || []).filter(m => m.id !== membership.id) }))
            } else {
              const { error } = await addToTalentPool(pool.id, savePopoverFor.id)
              if (error) return
              setMembershipsByStudent(prev => ({ ...prev, [savePopoverFor.id]: [...(prev[savePopoverFor.id] || []), { id: `${pool.id}-${savePopoverFor.id}`, pool_id: pool.id }] }))
              loadPools() // refresh member counts shown elsewhere
            }
          }}
          onCreatePool={async (name) => {
            if (!user) return
            const { data, error } = await createTalentPool(user.id, name)
            if (error || !data) return
            setPools(prev => [...prev, data])
            await addToTalentPool(data.id, savePopoverFor.id)
            setMembershipsByStudent(prev => ({ ...prev, [savePopoverFor.id]: [...(prev[savePopoverFor.id] || []), { id: `${data.id}-${savePopoverFor.id}`, pool_id: data.id }] }))
          }}
          onClose={() => setSavePopoverFor(null)}
        />
      )}

    </div>
  )
}

// Reuses the same add/remove/create primitives TalentPoolsPanel is
// built on -- this is just the other entry point into the same data
// ("save candidates into it from Discover", per that screen's own empty
// state copy, which is exactly the action that had gone missing here).
function SaveToPoolPopover({ studentName, pools, tier, memberships, onToggle, onCreatePool, onClose }: {
  studentName: string
  pools: any[]
  tier: EmployerTier
  memberships: { id: string; pool_id: string }[]
  onToggle: (pool: any, membership: { id: string; pool_id: string } | undefined) => void
  onCreatePool: (name: string) => void
  onClose: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const limit = EMPLOYER_TIERS[tier].talentPools
  const atLimit = limit !== null && pools.length >= limit
  const memberPoolIds = new Set(memberships.map(m => m.pool_id))

  return createPortal((
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold text-ink text-[15px]">Save {studentName}</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-tertiary transition"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[13px] text-ink-tertiary mb-4">Add them to a talent pool — LERN keeps them warm automatically from there.</p>

        {pools.length === 0 && !creating ? (
          <p className="text-[13px] text-ink-tertiary mb-4">No pools yet — create one below to save your first candidate.</p>
        ) : (
          <div className="space-y-1.5 mb-4 max-h-56 overflow-y-auto">
            {pools.map(pool => {
              const membership = memberships.find(m => m.pool_id === pool.id)
              const saved = memberPoolIds.has(pool.id)
              return (
                <button
                  key={pool.id}
                  onClick={() => onToggle(pool, membership)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-edge-subtle hover:border-brand transition text-left"
                >
                  <span className="text-[13.5px] font-semibold text-ink truncate">{pool.name}</span>
                  {saved ? <Check className="w-4 h-4 text-brand flex-shrink-0" /> : <Plus className="w-4 h-4 text-ink-quaternary flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        )}

        {creating ? (
          <div>
            <div className="flex items-center gap-2">
              <input
                value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. Design 2026"
                onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onCreatePool(name.trim()); setName(''); setCreating(false) } }}
                className="flex-1 bg-surface border border-edge rounded-lg px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition"
              />
              <button
                onClick={() => { if (name.trim()) { onCreatePool(name.trim()); setName(''); setCreating(false) } }}
                disabled={!name.trim()}
                className="bg-brand text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        ) : atLimit ? (
          <p className="text-[12px] text-ink-tertiary">At your {EMPLOYER_TIERS[tier].label} limit of {limit} pools — remove one, or upgrade in Settings, to create another.</p>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:opacity-80 transition"
          >
            <Plus className="w-3.5 h-3.5" /> New pool
          </button>
        )}
      </div>
    </div>
  ), document.body)
}

// The org sees this message verbatim on their side (Interest received)
// -- a few sentences saying what the employer's actually after, not
// just a bare "interested" flag with nothing to respond to. Exported --
// CandidateDetailPanel's own "Express interest" button reuses this
// exact composer rather than rebuilding it.
export function OfferComposer({ studentName, sending, error, onClose, onSend }: { studentName: string; sending: boolean; error?: string; onClose: () => void; onSend: (message: string) => void }) {
  const [message, setMessage] = useState('')
  return createPortal((
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-5">
        <p className="font-bold text-ink text-[15px] mb-1">Place your offer</p>
        <p className="text-[13px] text-ink-tertiary mb-4">
          A few sentences to {studentName}'s organisation about what you're after — they'll see this on their side.
        </p>
        <textarea
          value={message} onChange={e => setMessage(e.target.value)} autoFocus
          placeholder="e.g. We saw their verified poster work and we'd love to offer a week's work experience this term."
          rows={4}
          className="w-full bg-surface-subtle border border-edge rounded-lg px-3.5 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none mb-4"
        />
        {error && <p className="text-[12.5px] text-danger-text mb-3">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-ink-secondary hover:bg-surface-muted transition">Cancel</button>
          <button
            onClick={() => onSend(message.trim())} disabled={sending || !message.trim()}
            className="bg-brand text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg hover:bg-brand-hover transition disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  ), document.body)
}
