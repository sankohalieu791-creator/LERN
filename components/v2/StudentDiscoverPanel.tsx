'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getDiscoverWork, getOpportunities, getMyReceivedInterest, respondToInterest,
} from '@/lib/supabase'
import {
  Search, X, BadgeCheck, MapPin, Briefcase, Clock, Check, Ban,
} from 'lucide-react'

// Sizes/structure pulled from the real deleted v1 app/discovery/page.tsx
// (git show a07a8c2~1): "Discover" title + search bar, NO messaging
// icon in the header (dropped on purpose here, matching the app's "no
// messaging anywhere" rule), a horizontally-scrollable pill tab row
// (not a fixed segmented bar), rounded-2xl / p-4 / text-sm cards.
// Instructors tab is dropped entirely — that whole peer-mentorship
// concept doesn't exist in the new spec.
//
// Age changes what's on offer, not what the list looks like: everyone
// gets Explore/Jobs/Apprenticeships/Internships; only an 18+ student
// additionally gets Interest Received (employers who've expressed
// interest in them directly) -- for under-18s that same interest is
// visible only to their organisation's staff, never here.

type Tab = 'explore' | 'job' | 'apprenticeship' | 'internship' | 'received'

function isAdult(dob?: string) {
  if (!dob) return false
  return (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25) >= 18
}
function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
const TYPE_LABEL: Record<string, string> = { brief: 'Brief', course: 'Course', workshop: 'Workshop' }

export default function StudentDiscoverPanel() {
  const { user } = useAuth()
  const adult = isAdult(user?.date_of_birth)
  const [tab, setTab] = useState<Tab>('explore')
  const [search, setSearch] = useState('')
  const [work, setWork] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [interest, setInterest] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    if (tab === 'explore') {
      getDiscoverWork({ q: search.trim() || undefined }).then(({ data }) => { setWork(data || []); setLoading(false) })
    } else if (tab === 'received') {
      if (!user) return
      getMyReceivedInterest(user.id).then(({ data }) => { setInterest(data || []); setLoading(false) })
    } else {
      getOpportunities(tab).then(({ data }) => {
        const q = search.trim().toLowerCase()
        setOpportunities(q ? (data || []).filter((o: any) => o.title?.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q)) : (data || []))
        setLoading(false)
      })
    }
  }
  useEffect(load, [tab, user?.id])
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [search])

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    await respondToInterest(id, status)
    setInterest(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'explore', label: 'Explore' },
    { id: 'job', label: '💼 Jobs' },
    { id: 'apprenticeship', label: '🎓 Apprenticeships' },
    { id: 'internship', label: '📋 Internships' },
    ...(adult ? [{ id: 'received' as Tab, label: '📥 Interest received' }] : []),
  ]

  return (
    <div className="min-h-full">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-white text-2xl font-bold">Discover</h1>
        {tab === 'received' && <p className="text-[#666] text-sm mt-0.5">Employers who've expressed interest in you</p>}
        {!adult && tab !== 'explore' && tab !== 'received' && (
          <p className="text-[#666] text-sm mt-0.5">Interest goes to your organisation first — no employer contacts you directly.</p>
        )}
      </div>

      {tab !== 'received' && (
        <div className="px-4 mb-3">
          <div className="flex items-center gap-2 bg-[#1a1a1a] border border-white/[0.08] rounded-2xl px-4 py-3">
            <Search className="w-4 h-4 text-[#555] flex-shrink-0" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-white text-sm placeholder-[#444] outline-none"
            />
            {search && <button onClick={() => setSearch('')}><X className="w-4 h-4 text-[#555]" /></button>}
          </div>
        </div>
      )}

      <div className="px-4 flex gap-2 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(t => (
          <button
            key={t.id} onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition ${
              tab === t.id ? 'bg-white text-black' : 'bg-[#1a1a1a] text-[#888] border border-white/[0.08]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3 pb-6">
        {loading ? (
          <div className="space-y-3 pt-1">
            {[0, 1].map(i => (
              <div key={i} className="bg-[#1a1a1a] border border-white/[0.07] rounded-2xl p-4 h-28 animate-pulse" />
            ))}
          </div>
        ) : tab === 'explore' ? (
          work.length === 0 ? <EmptyState label="No public verified work matches yet — check back soon." /> : work.map(v => {
            const wi = v.submissions?.work_items
            const student = v.submissions?.student
            return (
              <div key={v.id} className="bg-[#1a1a1a] border border-white/[0.07] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold text-[#888] uppercase tracking-wide">{TYPE_LABEL[wi?.type] || wi?.type}</span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-[#4ade80] flex-shrink-0"><BadgeCheck className="w-3.5 h-3.5" /> Verified</span>
                </div>
                <p className="text-white font-bold text-[15px] leading-snug mb-1">{wi?.title}</p>
                {wi?.description && <p className="text-[#888] text-sm line-clamp-2 mb-3 leading-snug">{wi.description}</p>}
                <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#3A2E24] to-[#241C15] flex items-center justify-center text-white font-bold text-[9px] flex-shrink-0">
                    {initials(student?.full_name)}
                  </div>
                  <p className="text-[#888] text-xs">{student?.full_name} · verified {new Date(v.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
            )
          })
        ) : tab === 'received' ? (
          interest.length === 0 ? <EmptyState label="Nothing yet — when an employer's interested in your verified work, it'll show up here." /> : interest.map(i => (
            <div key={i.id} className="bg-[#1a1a1a] border border-white/[0.07] rounded-2xl p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#252525] flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0">
                  {initials(i.employer?.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm truncate">{i.employer?.full_name || 'An employer'}</p>
                  <p className="text-[#666] text-xs">{new Date(i.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
              {i.status === 'pending' ? (
                <div className="flex gap-2">
                  <button onClick={() => respond(i.id, 'accepted')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white">
                    <Check className="w-4 h-4" /> Accept
                  </button>
                  <button onClick={() => respond(i.id, 'declined')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-semibold bg-[#252525] text-[#888] border border-white/10">
                    <Ban className="w-4 h-4" /> Decline
                  </button>
                </div>
              ) : (
                <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full ${
                  i.status === 'accepted' ? 'bg-[#123a24] text-[#4ade80]' : 'bg-white/5 text-[#666]'
                }`}>
                  {i.status === 'accepted' ? 'Accepted' : 'Declined'}
                </span>
              )}
            </div>
          ))
        ) : (
          opportunities.length === 0 ? <EmptyState label={`No ${tab === 'job' ? 'jobs' : tab === 'apprenticeship' ? 'apprenticeships' : 'internships'} posted yet.`} icon={<Briefcase className="w-8 h-8 text-[#333] mb-2" />} /> : opportunities.map(o => (
            <div key={o.id} className="bg-[#1a1a1a] border border-white/[0.07] rounded-2xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-[#252525] flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">
                  {initials(o.employer?.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-base leading-tight">{o.title}</p>
                  {o.employer?.full_name && <p className="text-[#888] text-sm">{o.employer.full_name}</p>}
                </div>
              </div>
              {o.description && <p className="text-[#666] text-sm leading-relaxed line-clamp-2 mb-3">{o.description}</p>}
              <div className="flex items-center gap-1 text-[#555] text-xs">
                <Clock className="w-3 h-3" /> Posted {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function EmptyState({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="text-center py-16">
      {icon ?? <Search className="w-8 h-8 text-[#333] mx-auto mb-3" />}
      <p className="text-[#666] text-sm">{label}</p>
    </div>
  )
}
