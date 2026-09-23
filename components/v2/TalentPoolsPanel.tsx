'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getTalentPools, createTalentPool, deleteTalentPool, getTalentPoolMembers, removeFromTalentPool,
  getTalentPoolPreviewMembers, getEmployerBilling, setPoolRoleFilled, setPoolCustomCadence, getCadenceSends,
} from '@/lib/supabase'
import { EMPLOYER_TIERS, type EmployerTier } from '@/lib/billing'
import { cadenceForPool, nextStage, DEFAULT_CADENCE, type CadenceStep } from '@/lib/cadence'
import { useAvatarUrl } from '@/lib/useAvatarUrl'
import { Bookmark, Plus, X, Trash2, ChevronLeft, UserCheck, Users, CheckCircle2, Clock, Settings2, Sparkles } from 'lucide-react'

// Talent pools -- Final Build Spec, 23 Sep 2026. "The employer's only
// two actions are adding a candidate to a pool and removing them, or
// marking a role filled. Everything else runs with no employer input."
// The old manual "Send now" is gone entirely -- it was this feature's
// own honest interim before a real scheduled sender existed (see the
// git history on this file). Now /api/cron/talent-pool-cadence sends
// every stage itself, on a schedule; this screen is read-only about
// what's already gone out and what's due next.
function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
function timeAgo(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days < 1) return 'today'
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 8) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function CandidateAvatar({ person, size = 36 }: { person: { full_name?: string; avatar_path?: string | null }; size?: number }) {
  const url = useAvatarUrl(person.avatar_path)
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
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState('')
  const [openPool, setOpenPool] = useState<any | null>(null)

  const load = () => {
    if (!user) return
    setLoading(true)
    Promise.all([getTalentPools(user.id), getEmployerBilling(user.id)]).then(async ([poolsRes, billingRes]) => {
      const rows = poolsRes.data || []
      setPools(rows)
      setBilling(billingRes.data)
      setLoading(false)
      const entries = await Promise.all(rows.map(async (p: any) => {
        const { data: members } = await getTalentPoolPreviewMembers(p.id)
        return [p.id, (members || []).map((m: any) => m.student).filter(Boolean)] as const
      }))
      setPreviews(Object.fromEntries(entries))
    })
  }
  useEffect(load, [user?.id])

  const tier = (billing?.tier as EmployerTier) || 'micro'
  const limit = EMPLOYER_TIERS[tier].talentPools
  const atLimit = limit !== null && pools.length >= limit

  const submit = async () => {
    if (!name.trim() || !user) return
    setCreateError('')
    if (atLimit) return setCreateError(`You're at your ${EMPLOYER_TIERS[tier].label} limit of ${limit} pools — remove one, or upgrade in Settings, to create another.`)
    const { error } = await createTalentPool(user.id, name.trim())
    if (error) { setCreateError("Couldn't create that pool — try again."); return }
    setName(''); setCreating(false); load()
  }

  if (openPool) return <PoolDetail pool={openPool} tier={tier} onBack={() => { setOpenPool(null); load() }} />

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[18px] font-bold text-ink">Talent pools</p>
        <button
          onClick={() => setCreating(v => !v)}
          className="flex items-center gap-1.5 bg-brand text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold hover:opacity-90 transition"
        >
          {creating ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} New pool
        </button>
      </div>
      <p className="text-[13px] text-ink-tertiary mb-1">Fully automatic, no action needed from you</p>
      {!loading && (
        <p className="text-[12px] text-ink-quaternary mb-4">
          {pools.length} of {limit === null ? 'unlimited' : limit} pools used on {EMPLOYER_TIERS[tier].label}
        </p>
      )}

      <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 mb-5" style={{ backgroundColor: '#E6F1FB' }}>
        <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#0C447C' }} />
        <p className="text-[12px] leading-relaxed" style={{ color: '#0C447C' }}>
          You only ever do two things here: add someone to a pool, or remove them. LERN sends every update automatically.
        </p>
      </div>

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
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {p.role_filled_at && (
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-surface-muted text-ink-tertiary">Filled</span>
                    )}
                    <span className="flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-surface-muted text-ink-secondary">
                      <Users className="w-3 h-3" /> {count}
                    </span>
                  </div>
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

function PoolDetail({ pool, tier, onBack }: { pool: any; tier: EmployerTier; onBack: () => void }) {
  const [members, setMembers] = useState<any[]>([])
  const [sends, setSends] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCadence, setEditingCadence] = useState(false)
  const [filling, setFilling] = useState(false)
  const canCustomise = tier === 'scale' || tier === 'enterprise'

  const load = () => {
    setLoading(true)
    getTalentPoolMembers(pool.id).then(async ({ data }) => {
      const rows = data || []
      setMembers(rows)
      const { data: sendRows } = await getCadenceSends(rows.map((m: any) => m.id))
      setSends(sendRows || [])
      setLoading(false)
    })
  }
  useEffect(load, [pool.id])

  const remove = async () => {
    if (!confirm(`Delete "${pool.name}"? This removes the list, not the candidates themselves.`)) return
    const { error } = await deleteTalentPool(pool.id)
    if (error) { alert("Couldn't delete that pool — try again."); return }
    onBack()
  }

  const toggleFilled = async () => {
    setFilling(true)
    await setPoolRoleFilled(pool.id, !pool.role_filled_at)
    setFilling(false)
    onBack()
  }

  const cadence = cadenceForPool(pool.custom_cadence)

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-ink-tertiary hover:text-ink transition mb-4">
        <ChevronLeft className="w-4 h-4" /> Talent pools
      </button>
      <div className="flex items-center justify-between mb-1 gap-3">
        <p className="text-[19px] font-bold text-ink truncate">{pool.name}</p>
        <div className="flex items-center gap-3 flex-shrink-0">
          {canCustomise && (
            <button onClick={() => setEditingCadence(true)} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-secondary hover:text-brand transition">
              <Settings2 className="w-3.5 h-3.5" /> Customise cadence
            </button>
          )}
          <button onClick={toggleFilled} disabled={filling} className="text-[12.5px] font-semibold text-ink-secondary hover:text-brand transition">
            {pool.role_filled_at ? 'Reopen role' : 'Mark role filled'}
          </button>
          <button onClick={remove} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-danger-text hover:underline">
            <Trash2 className="w-3.5 h-3.5" /> Delete pool
          </button>
        </div>
      </div>
      <p className="text-[13px] text-ink-tertiary mb-5">
        {members.length} candidate{members.length === 1 ? '' : 's'} saved
        {pool.role_filled_at && ' · Role filled — automatic cadence has stopped'}
      </p>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map(i => <div key={i} className="h-24 rounded-xl bg-surface animate-pulse" />)}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-edge-subtle rounded-2xl">
          <UserCheck className="w-7 h-7 text-ink-quaternary mx-auto mb-2.5" />
          <p className="text-[13px] text-ink-tertiary">Nobody saved here yet — bookmark a candidate from Discover.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {members.map(m => {
            const memberSends = sends.filter(s => s.member_id === m.id).sort((a, b) => a.stage - b.stage)
            const sentStages = memberSends.map(s => s.stage)
            const upcoming = pool.role_filled_at ? null : nextStage(cadence, sentStages, m.created_at)
            return (
              <div key={m.id} className="bg-surface border border-edge rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <CandidateAvatar person={m.student || {}} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-ink truncate">{m.student?.full_name}</p>
                    <p className="text-[11.5px] text-ink-tertiary mt-0.5">Added {timeAgo(m.created_at)}</p>
                  </div>
                  <span className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={pool.role_filled_at ? { backgroundColor: '#F1EFE8', color: '#5F5E5A' } : { backgroundColor: '#E1F5EE', color: '#0F6E56' }}>
                    {pool.role_filled_at ? 'Filled' : 'Warm'}
                  </span>
                  <button
                    onClick={async () => { await removeFromTalentPool(m.id); load() }}
                    aria-label="Remove from pool"
                    className="w-8 h-8 flex items-center justify-center rounded-full text-ink-tertiary hover:text-danger-text hover:bg-surface-muted transition flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="pl-[52px] space-y-1">
                  {memberSends.map(s => (
                    <p key={s.stage} className="flex items-center gap-1.5 text-[12px]" style={{ color: '#0F6E56' }}>
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> Week {s.stage}: {s.label}, sent automatically
                    </p>
                  ))}
                  {upcoming && (
                    <p className="flex items-center gap-1.5 text-[12px] text-warning-text">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" /> Week {upcoming.stage}: {upcoming.label}, scheduled for {fmtDate(upcoming.dueDate)}, sends itself
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editingCadence && (
        <CadenceEditor
          poolId={pool.id}
          initial={pool.custom_cadence || DEFAULT_CADENCE}
          onClose={() => setEditingCadence(false)}
          onSaved={() => { setEditingCadence(false); onBack() }}
        />
      )}
    </div>
  )
}

function CadenceEditor({ poolId, initial, onClose, onSaved }: { poolId: string; initial: CadenceStep[]; onClose: () => void; onSaved: () => void }) {
  const [steps, setSteps] = useState<CadenceStep[]>(initial.map(s => ({ ...s })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (i: number, field: keyof CadenceStep, value: string) => {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: field === 'day' ? Number(value) || 0 : value } : s))
  }

  const save = async () => {
    setError('')
    if (steps.some(s => !s.day || !s.label.trim() || !s.message.trim())) return setError('Every step needs a day, a label, and a message.')
    setSaving(true)
    const { error: err } = await setPoolCustomCadence(poolId, steps)
    setSaving(false)
    if (err) { setError(err.message || "Couldn't save — try again."); return }
    onSaved()
  }

  const resetToDefault = async () => {
    setSaving(true)
    await setPoolCustomCadence(poolId, null)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[85dvh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge-subtle flex-shrink-0">
          <p className="font-bold text-ink text-[15px]">Customise this pool's cadence</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-tertiary transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {steps.map((s, i) => (
            <div key={i} className="border border-edge-subtle rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px] font-bold text-ink-tertiary flex-shrink-0">Step {i + 1} · day</span>
                <input
                  type="number" min={1} value={s.day} onChange={e => update(i, 'day', e.target.value)}
                  className="w-16 bg-surface-subtle border border-edge rounded-lg px-2 py-1 text-[13px] text-ink outline-none focus:border-brand transition"
                />
              </div>
              <input
                value={s.label} onChange={e => update(i, 'label', e.target.value)} placeholder="Label, e.g. Workshop invite"
                className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2 text-[13px] font-semibold text-ink outline-none focus:border-brand transition mb-2"
              />
              <textarea
                value={s.message} onChange={e => update(i, 'message', e.target.value)} rows={3}
                className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-brand transition resize-none"
              />
            </div>
          ))}
          {error && <p className="text-[12px] text-danger-text">{error}</p>}
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-edge-subtle flex-shrink-0">
          <button onClick={resetToDefault} disabled={saving} className="text-[12.5px] font-semibold text-ink-tertiary hover:text-ink transition">Reset to default</button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-ink-secondary hover:bg-surface-muted transition">Cancel</button>
            <button onClick={save} disabled={saving} className="bg-brand text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg hover:bg-brand-hover transition disabled:opacity-40">
              {saving ? 'Saving…' : 'Save cadence'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
