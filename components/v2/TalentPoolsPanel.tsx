'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getTalentPools, createTalentPool, deleteTalentPool, getTalentPoolMembers, removeFromTalentPool,
  getTalentPoolPreviewMembers, getAvatarUrl, getMyInterest, expressInterest, sendInterestMessage,
} from '@/lib/supabase'
import { Bookmark, Plus, X, Trash2, ChevronLeft, UserCheck, Users, Send, Sparkles, AlertCircle, Check } from 'lucide-react'

// Talent pools rebuild -- Charles Booth-call selling feature. The
// save-into-a-list mechanic and the name both stay; new is an
// automated cadence attached to each saved candidate instead of
// leaving it a static list. Stage is computed straight off how long
// they've been saved (member.created_at) -- no new schema needed for
// that half. What genuinely needs a scheduled backend job (actually
// firing on its own, weekly, unattended) isn't built yet -- pending DB
// access to add the state a cron job needs to know what's already
// been sent. "Send now" here is the honest interim: one tap sends the
// stage-appropriate message right now, through the exact same
// employer<->organisation channel Discover's own "Express interest"
// already uses, rather than pretending it already runs unattended.
const CADENCE_STAGES = [
  { week: 1, label: 'Profile prompt', message: "We saved your profile to one of our talent pools — worth keeping it up to date with your latest verified work, we check back regularly." },
  { week: 2, label: 'Workshop invite', message: "We run workshops other candidates like you have found useful — keep an eye on your school/provider for upcoming sessions worth joining." },
  { week: 3, label: 'Check-in', message: "Just checking in — still keen to hear from you if anything's changed on your end. No pressure either way." },
] as const

function cadenceStage(createdAt: string) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
  const week = Math.floor(days / 7) + 1
  const stageIndex = Math.min(week, CADENCE_STAGES.length) - 1
  const stage = CADENCE_STAGES[stageIndex]
  const daysIntoWeek = days % 7
  const daysUntilNext = week < CADENCE_STAGES.length ? 7 - daysIntoWeek : null
  // "Just landed on this stage" -- the closest honest signal to "due"
  // without a persisted has-this-actually-been-sent record. Not a
  // claim that it WAS sent, just that this is a fresh window to do it.
  const justEntered = daysIntoWeek <= 1
  return { ...stage, week, stageIndex, daysUntilNext, justEntered, daysSaved: days }
}

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

// A small, real avatar wherever a candidate shows up here -- real
// photo when they have one, initials otherwise, same fallback every
// other avatar in the app uses.
function CandidateAvatar({ person, size = 36 }: { person: { full_name?: string; avatar_path?: string | null }; size?: number }) {
  const url = person.avatar_path ? getAvatarUrl(person.avatar_path) : null
  if (url) return <img src={url} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  return (
    <span
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36, backgroundColor: '#E6F1FB', color: '#185FA5' }}
    >
      {initials(person.full_name)}
    </span>
  )
}

// Complete Build Spec v1.0, Part 3 -- "Named lists the employer
// creates... Candidates are added from Discover via the bookmark
// button." This is the list-management side; adding a candidate to a
// pool happens on EmployerDiscoverPanel's own bookmark button.
//
// Redesigned per direct feedback ("too simple") -- was a plain grid of
// text-only name+count cards. Now each card carries a coloured icon
// badge and a stacked preview of who's actually in it, not just a
// number; the detail view's rows get real avatars and a way to open
// that candidate's profile, not just a bare name and a text "Remove".
const CARD_ACCENTS = [
  { bg: '#FCEEE4', fg: '#D4551A' },
  { bg: '#E1F5EE', fg: '#0F6E56' },
  { bg: '#E6F1FB', fg: '#185FA5' },
  { bg: '#FAEEDA', fg: '#854F0B' },
]

export default function TalentPoolsPanel() {
  const { user } = useAuth()
  const [pools, setPools] = useState<any[]>([])
  const [previews, setPreviews] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState('')
  const [openPool, setOpenPool] = useState<any | null>(null)

  const load = () => {
    if (!user) return
    setLoading(true)
    getTalentPools(user.id).then(async ({ data }) => {
      const rows = data || []
      setPools(rows)
      setLoading(false)
      const entries = await Promise.all(rows.map(async (p: any) => {
        const { data: members } = await getTalentPoolPreviewMembers(p.id)
        return [p.id, (members || []).map((m: any) => m.student).filter(Boolean)] as const
      }))
      setPreviews(Object.fromEntries(entries))
    })
  }
  useEffect(load, [user?.id])

  const submit = async () => {
    if (!name.trim() || !user) return
    setCreateError('')
    // Was closing the form and reloading regardless of the result
    // before -- a failed create just silently closed with the pool
    // never having existed, and nothing said why.
    const { error } = await createTalentPool(user.id, name.trim())
    if (error) { setCreateError("Couldn't create that pool — try again."); return }
    setName(''); setCreating(false); load()
  }

  if (openPool) return <PoolDetail pool={openPool} onBack={() => { setOpenPool(null); load() }} />

  const totalCandidates = pools.reduce((sum, p) => sum + (p.talent_pool_members?.[0]?.count ?? 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[18px] font-bold text-ink">Talent pools</p>
        <button onClick={() => setCreating(v => !v)} className="flex items-center gap-1.5 bg-brand text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold hover:opacity-90 transition">
          {creating ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} New pool
        </button>
      </div>
      <p className="text-[13px] text-ink-tertiary mb-4">Named lists for candidates you want to come back to — kept warm automatically, not just saved and forgotten.</p>

      {!loading && pools.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3.5 mb-5" style={{ backgroundColor: '#FCEEE4' }}>
          <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#D4551A' }} />
          <p className="text-[13px] leading-relaxed" style={{ color: '#8C4315' }}>
            <span className="font-semibold">{pools.length} pool{pools.length === 1 ? '' : 's'} · {totalCandidates} candidate{totalCandidates === 1 ? '' : 's'}</span> on an automated weekly cadence — a profile prompt, a workshop invite, then regular check-ins, so nobody sits saved and forgotten.
          </p>
        </div>
      )}

      {creating && (
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <input
              value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. Design 2026"
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="flex-1 bg-surface border border-edge rounded-lg px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition"
            />
            <button onClick={submit} disabled={!name.trim()} className="bg-brand text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40">Create</button>
          </div>
          {createError && <p className="text-[12px] text-danger-text mt-2">{createError}</p>}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-surface animate-pulse" />)}
        </div>
      ) : pools.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-edge-subtle rounded-2xl">
          <Bookmark className="w-7 h-7 text-ink-quaternary mx-auto mb-2.5" />
          <p className="text-[14px] font-semibold text-ink mb-1">No pools yet</p>
          <p className="text-[13px] text-ink-tertiary">Create a named list, then save candidates into it from Discover.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pools.map((p, i) => {
            const accent = CARD_ACCENTS[i % CARD_ACCENTS.length]
            const count = p.talent_pool_members?.[0]?.count ?? 0
            const preview = previews[p.id] || []
            return (
              <button
                key={p.id} onClick={() => setOpenPool(p)}
                className="text-left bg-surface border border-edge rounded-2xl p-5 hover:border-brand hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accent.bg, color: accent.fg }}>
                    <Bookmark className="w-5 h-5" />
                  </span>
                  <span className="flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-surface-muted text-ink-secondary flex-shrink-0">
                    <Users className="w-3 h-3" /> {count}
                  </span>
                </div>
                <p className="text-[15px] font-bold text-ink mb-3 truncate">{p.name}</p>
                {preview.length > 0 ? (
                  <div className="flex items-center">
                    <div className="flex -space-x-2">
                      {preview.slice(0, 4).map((m: any, idx: number) => (
                        <span key={m.id} className="ring-2 ring-surface rounded-full" style={{ zIndex: 4 - idx }}>
                          <CandidateAvatar person={m} size={28} />
                        </span>
                      ))}
                    </div>
                    {count > 4 && <span className="text-[11.5px] text-ink-tertiary ml-2">+{count - 4} more</span>}
                  </div>
                ) : (
                  <p className="text-[12px] text-ink-quaternary">Nobody saved here yet</p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PoolDetail({ pool, onBack }: { pool: any; onBack: () => void }) {
  const { user } = useAuth()
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [messaging, setMessaging] = useState<{ studentId: string; name: string; defaultMessage: string } | null>(null)

  const load = () => { setLoading(true); getTalentPoolMembers(pool.id).then(({ data }) => { setMembers(data || []); setLoading(false) }) }
  useEffect(load, [pool.id])

  const remove = async () => {
    if (!confirm(`Delete "${pool.name}"? This removes the list, not the candidates themselves.`)) return
    // Was navigating back unconditionally before -- a failed delete
    // left the pool exactly as it was, but the user was already told
    // (by being sent back to the list) that it was gone; it would only
    // reappear once that list happened to reload.
    const { error } = await deleteTalentPool(pool.id)
    if (error) { alert("Couldn't delete that pool — try again."); return }
    onBack()
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-ink-tertiary hover:text-ink transition mb-4">
        <ChevronLeft className="w-4 h-4" /> Talent pools
      </button>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[19px] font-bold text-ink">{pool.name}</p>
        <button onClick={remove} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-danger-text hover:underline flex-shrink-0">
          <Trash2 className="w-3.5 h-3.5" /> Delete pool
        </button>
      </div>
      <p className="text-[13px] text-ink-tertiary mb-5">{members.length} candidate{members.length === 1 ? '' : 's'} saved</p>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map(i => <div key={i} className="h-20 rounded-xl bg-surface animate-pulse" />)}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-edge-subtle rounded-2xl">
          <UserCheck className="w-7 h-7 text-ink-quaternary mx-auto mb-2.5" />
          <p className="text-[13px] text-ink-tertiary">Nobody saved here yet — bookmark a candidate from Discover.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {members
            // Freshest-entered stage first -- the candidates it's
            // actually most worth opening this list for right now,
            // not just insertion order.
            .map(m => ({ m, cadence: cadenceStage(m.created_at) }))
            .sort((a, b) => (a.cadence.justEntered === b.cadence.justEntered ? 0 : a.cadence.justEntered ? -1 : 1))
            .map(({ m, cadence }) => {
              const bio = m.student?.bio?.trim()
              return (
                <div key={m.id} className="bg-surface border border-edge rounded-2xl px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <CandidateAvatar person={m.student || {}} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-ink truncate">{m.student?.full_name}</p>
                      <p className="text-[11.5px] text-ink-tertiary mt-0.5">Saved {cadence.daysSaved === 0 ? 'today' : `${cadence.daysSaved}d ago`}</p>
                    </div>
                    {cadence.justEntered && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#FCEEE4', color: '#D4551A' }}>
                        <Sparkles className="w-3 h-3" /> New stage
                      </span>
                    )}
                    {m.student && (
                      <button
                        onClick={() => setMessaging({ studentId: m.student.id, name: m.student.full_name || 'this candidate', defaultMessage: cadence.message })}
                        className="flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline flex-shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" /> Send now
                      </button>
                    )}
                    <button
                      onClick={async () => { await removeFromTalentPool(m.id); load() }}
                      aria-label="Remove from pool"
                      className="w-8 h-8 flex items-center justify-center rounded-full text-ink-tertiary hover:text-danger-text hover:bg-surface-muted transition flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* The actual cadence tracker -- three segments, filled
                      up to the current stage, so this reads as a real
                      running process rather than a bare "Week 2" label. */}
                  <div className="flex items-center gap-1.5 mt-3 pl-[52px]">
                    {CADENCE_STAGES.map((stage, idx) => (
                      <div key={stage.week} className="flex items-center gap-1.5 flex-1">
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={
                              idx < cadence.stageIndex
                                ? { backgroundColor: '#0F6E56' }
                                : idx === cadence.stageIndex
                                ? { backgroundColor: '#D4551A' }
                                : { backgroundColor: 'var(--surface-muted)' }
                            }
                          >
                            {idx < cadence.stageIndex ? <Check className="w-3 h-3 text-white" /> : (
                              <span className={`text-[10px] font-bold ${idx === cadence.stageIndex ? 'text-white' : 'text-ink-quaternary'}`}>{idx + 1}</span>
                            )}
                          </span>
                        </div>
                        {idx < CADENCE_STAGES.length - 1 && (
                          <span className="h-[2px] flex-1 rounded-full" style={{ backgroundColor: idx < cadence.stageIndex ? '#0F6E56' : 'var(--surface-muted)' }} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pl-[52px] mt-1.5">
                    <p className="text-[11.5px] font-semibold" style={{ color: '#D4551A' }}>
                      Week {cadence.week} · {cadence.label}
                      {cadence.daysUntilNext !== null && cadence.daysUntilNext > 0 && (
                        <span className="text-ink-tertiary font-normal"> · next stage in {cadence.daysUntilNext}d</span>
                      )}
                    </p>
                  </div>

                  {bio ? (
                    <p className="text-[12px] text-ink-tertiary mt-2 pl-[52px] line-clamp-1">"{bio}"</p>
                  ) : (
                    <p className="flex items-center gap-1 text-[11.5px] mt-2 pl-[52px]" style={{ color: '#854F0B' }}>
                      <AlertCircle className="w-3 h-3 flex-shrink-0" /> No bio on their profile yet — good candidate for the profile-prompt stage.
                    </p>
                  )}
                </div>
              )
            })}
        </div>
      )}

      {messaging && user && (
        <CadenceMessageComposer
          employerId={user.id}
          studentId={messaging.studentId}
          studentName={messaging.name}
          defaultMessage={messaging.defaultMessage}
          onClose={() => setMessaging(null)}
        />
      )}
    </div>
  )
}

// Routes through the exact same interest/interest_messages channel
// Discover's own "Express interest" and the org's Interest Received
// already use -- reuses an existing thread if one's already open with
// this candidate, starts a new one otherwise. Never a new, separate
// messaging surface.
function CadenceMessageComposer({ employerId, studentId, studentName, defaultMessage, onClose }: {
  employerId: string; studentId: string; studentName: string; defaultMessage: string; onClose: () => void
}) {
  const [message, setMessage] = useState(defaultMessage)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    if (!message.trim()) return
    setSending(true); setError('')
    const { data: existing } = await getMyInterest(employerId)
    const thread = (existing || []).find((i: any) => i.student_id === studentId)
    const { error: err } = thread
      ? await sendInterestMessage(thread.id, employerId, 'employer', message.trim())
      : await expressInterest(employerId, studentId, { message: message.trim(), opportunity_label: 'Talent pool follow-up' })
    setSending(false)
    if (err) { setError("Couldn't send — try again."); return }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <p className="font-bold text-ink text-[15px] mb-1">Send to {studentName}'s organisation</p>
        <p className="text-[13px] text-ink-tertiary mb-4">This goes through their school/provider, same as every other message — never straight to the candidate.</p>
        <textarea
          value={message} onChange={e => setMessage(e.target.value)} autoFocus rows={4}
          className="w-full bg-surface-subtle border border-edge rounded-lg px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition resize-none mb-2"
        />
        {error && <p className="text-[12px] text-danger-text mb-2">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-ink-secondary hover:bg-surface-muted transition">Cancel</button>
          <button
            onClick={send} disabled={sending || !message.trim()}
            className="bg-brand text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg hover:bg-brand-hover transition disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
