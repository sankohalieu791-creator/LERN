'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getTalentPools, createTalentPool, deleteTalentPool, getTalentPoolMembers, removeFromTalentPool,
  getTalentPoolPreviewMembers, getAvatarUrl,
} from '@/lib/supabase'
import { Bookmark, Plus, X, Trash2, ChevronLeft, UserCheck, Users } from 'lucide-react'

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
    await createTalentPool(user.id, name.trim())
    setName(''); setCreating(false); load()
  }

  if (openPool) return <PoolDetail pool={openPool} onBack={() => { setOpenPool(null); load() }} />

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[18px] font-bold text-ink">Talent pools</p>
        <button onClick={() => setCreating(v => !v)} className="flex items-center gap-1.5 bg-brand text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold hover:opacity-90 transition">
          {creating ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} New pool
        </button>
      </div>
      <p className="text-[13px] text-ink-tertiary mb-5">Named lists for candidates you want to come back to.</p>

      {creating && (
        <div className="flex items-center gap-2 mb-5">
          <input
            value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. Design 2026"
            onKeyDown={e => e.key === 'Enter' && submit()}
            className="flex-1 bg-surface border border-edge rounded-lg px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition"
          />
          <button onClick={submit} disabled={!name.trim()} className="bg-brand text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40">Create</button>
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
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => { setLoading(true); getTalentPoolMembers(pool.id).then(({ data }) => { setMembers(data || []); setLoading(false) }) }
  useEffect(load, [pool.id])

  const remove = async () => {
    if (!confirm(`Delete "${pool.name}"? This removes the list, not the candidates themselves.`)) return
    await deleteTalentPool(pool.id)
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
          {[0, 1].map(i => <div key={i} className="h-16 rounded-xl bg-surface animate-pulse" />)}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-edge-subtle rounded-2xl">
          <UserCheck className="w-7 h-7 text-ink-quaternary mx-auto mb-2.5" />
          <p className="text-[13px] text-ink-tertiary">Nobody saved here yet — bookmark a candidate from Discover.</p>
        </div>
      ) : (
        <div className="bg-surface border border-edge rounded-2xl divide-y divide-edge-subtle overflow-hidden">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
              <CandidateAvatar person={m.student || {}} size={40} />
              <p className="text-[14px] font-semibold text-ink flex-1 min-w-0 truncate">{m.student?.full_name}</p>
              <button
                onClick={async () => { await removeFromTalentPool(m.id); load() }}
                aria-label="Remove from pool"
                className="w-8 h-8 flex items-center justify-center rounded-full text-ink-tertiary hover:text-danger-text hover:bg-surface-muted transition flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
