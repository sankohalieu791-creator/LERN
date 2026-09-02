'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getTalentPools, createTalentPool, deleteTalentPool, getTalentPoolMembers, removeFromTalentPool,
} from '@/lib/supabase'
import { Bookmark, Plus, X, Trash2, ChevronLeft, UserCheck } from 'lucide-react'

// Complete Build Spec v1.0, Part 3 -- "Named lists the employer
// creates... Candidates are added from Discover via the bookmark
// button." This is the list-management side; adding a candidate to a
// pool happens on EmployerDiscoverPanel's own bookmark button.
export default function TalentPoolsPanel() {
  const { user } = useAuth()
  const [pools, setPools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [openPool, setOpenPool] = useState<any | null>(null)

  const load = () => {
    if (!user) return
    setLoading(true)
    getTalentPools(user.id).then(({ data }) => { setPools(data || []); setLoading(false) })
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
      <div className="flex items-center justify-between mb-5">
        <p className="text-[18px] font-medium text-ink">Talent pools</p>
        <button onClick={() => setCreating(v => !v)} className="flex items-center gap-1.5 bg-surface border border-edge rounded-lg px-3.5 py-2 text-[13px] font-semibold text-ink-secondary hover:border-edge-input transition">
          {creating ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} New pool
        </button>
      </div>

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
        <p className="text-[13px] text-ink-tertiary">Loading…</p>
      ) : pools.length === 0 ? (
        <div className="text-center py-16">
          <Bookmark className="w-7 h-7 text-ink-quaternary mx-auto mb-2.5" />
          <p className="text-[14px] font-semibold text-ink mb-1">No pools yet</p>
          <p className="text-[13px] text-ink-tertiary">Create a named list, then save candidates into it from Discover.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pools.map(p => (
            <button key={p.id} onClick={() => setOpenPool(p)} className="text-left bg-surface border border-edge rounded-2xl p-5 hover:border-brand transition">
              <p className="text-[15px] font-medium text-ink mb-1">{p.name}</p>
              <p className="text-[13px] text-ink-tertiary">{p.talent_pool_members?.[0]?.count ?? 0} saved</p>
            </button>
          ))}
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
      <div className="flex items-center justify-between mb-5">
        <p className="text-[18px] font-medium text-ink">{pool.name}</p>
        <button onClick={remove} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-danger-text hover:underline">
          <Trash2 className="w-3.5 h-3.5" /> Delete pool
        </button>
      </div>
      {loading ? (
        <p className="text-[13px] text-ink-tertiary">Loading…</p>
      ) : members.length === 0 ? (
        <div className="text-center py-16">
          <UserCheck className="w-7 h-7 text-ink-quaternary mx-auto mb-2.5" />
          <p className="text-[13px] text-ink-tertiary">Nobody saved here yet — bookmark a candidate from Discover.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between bg-surface border border-edge rounded-xl px-4 py-3">
              <p className="text-[13px] font-medium text-ink">{m.student?.full_name}</p>
              <button onClick={async () => { await removeFromTalentPool(m.id); load() }} className="text-[12px] font-semibold text-ink-tertiary hover:text-danger-text transition">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
