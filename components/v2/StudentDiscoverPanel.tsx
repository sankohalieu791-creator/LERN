'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getDiscoverWork, getOpportunities, getMyReceivedInterest, respondToInterest,
  applyToOpportunity, getMyOpportunityApplications, getAvatarUrl, getMyApplications,
} from '@/lib/supabase'
import type { ApplicationStage } from '@/lib/supabase'
import {
  Search, X, BadgeCheck, MapPin, Briefcase, Clock, Check, Ban, Send, LineChart,
} from 'lucide-react'

const STAGE_META: Record<ApplicationStage, { label: string; bg: string; text: string }> = {
  applied: { label: 'Applied', bg: '#E6F1FB', text: '#185FA5' },
  reviewing: { label: 'Reviewing', bg: '#FAEEDA', text: '#854F0B' },
  shortlisted: { label: 'Shortlisted', bg: '#FAEEDA', text: '#854F0B' },
  interview: { label: 'Interview', bg: '#FAEEDA', text: '#854F0B' },
  offer: { label: 'Offer', bg: '#FAEEDA', text: '#854F0B' },
  hired: { label: 'Hired', bg: '#E1F5EE', text: '#0F6E56' },
  not_progressing: { label: 'Not progressing', bg: '#F1EFE8', text: '#5F5E5A' },
}

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

type Tab = 'explore' | 'job' | 'apprenticeship' | 'internship' | 'received' | 'tracking'

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
  const router = useRouter()
  const adult = isAdult(user?.date_of_birth)
  const [tab, setTab] = useState<Tab>('explore')
  const [search, setSearch] = useState('')
  const [work, setWork] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [applicationByOpp, setApplicationByOpp] = useState<Record<string, string>>({})
  const [applying, setApplying] = useState<string | null>(null)
  const [interest, setInterest] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [stageByOpp, setStageByOpp] = useState<Record<string, ApplicationStage>>({})
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    if (tab === 'explore') {
      getDiscoverWork({ q: search.trim() || undefined }).then(({ data }) => { setWork(data || []); setLoading(false) })
    } else if (tab === 'received') {
      if (!user) return
      getMyReceivedInterest(user.id).then(({ data }) => { setInterest(data || []); setLoading(false) })
    } else if (tab === 'tracking') {
      if (!user) return
      getMyApplications(user.id).then(({ data }) => { setApplications(data || []); setLoading(false) })
    } else {
      getOpportunities(tab).then(({ data }) => {
        const q = search.trim().toLowerCase()
        setOpportunities(q ? (data || []).filter((o: any) => o.title?.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q)) : (data || []))
        setLoading(false)
      })
      if (user) getMyOpportunityApplications(user.id).then(({ data }) => {
        const map: Record<string, string> = {}
        for (const a of data || []) map[a.opportunity_id] = a.status
        setApplicationByOpp(map)
      })
    }
    // Real stage, wherever there is one -- read alongside every tab
    // (not just "tracking") so an opportunity card can show the actual
    // pipeline stage instead of a flat "Applied — pending" the moment
    // it moves past Applied.
    if (user && tab !== 'tracking') getMyApplications(user.id).then(({ data }) => {
      const map: Record<string, ApplicationStage> = {}
      for (const a of data || []) if (a.opportunity_id) map[a.opportunity_id] = a.stage
      setStageByOpp(map)
    })
  }
  useEffect(load, [tab, user?.id])
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [search])

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    await respondToInterest(id, status)
    setInterest(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  const apply = async (opportunityId: string) => {
    if (!user) return
    setApplying(opportunityId)
    const { error } = await applyToOpportunity(opportunityId, user.id)
    setApplying(null)
    if (!error) setApplicationByOpp(prev => ({ ...prev, [opportunityId]: 'pending' }))
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'explore', label: 'Explore' },
    { id: 'job', label: '💼 Jobs' },
    { id: 'apprenticeship', label: '🎓 Apprenticeships' },
    { id: 'internship', label: '📋 Internships' },
    // Job tracking (own applications, real pipeline stage) is 18+
    // only, same rule as Interest received -- under-18s' interest with
    // an employer is always mediated through their org, never surfaced
    // to them directly here.
    ...(adult ? [{ id: 'received' as Tab, label: '📥 Interest received' }, { id: 'tracking' as Tab, label: '📊 Job tracking' }] : []),
  ]

  return (
    // No min-h-full here -- it forced this div to be at least as tall as
    // main's own visible box regardless of how little content a tab
    // actually has (e.g. Explore's empty state, or a short Jobs list),
    // which is exactly what "scrolling goes all the way down" into
    // blank space was: an extra almost-full-screen of empty scrollable
    // area below the real content. main already paints its own full-
    // bleed dark background, so nothing here needs to force full height
    // to "fill the screen" -- it can just size to its actual content.
    <div>
      {/* Fixed height regardless of tab -- a conditional second line here
          used to only show for under-18s on the opportunity tabs, which
          pushed the search bar/tab row/content down a few px on Jobs
          versus Explore. The safeguarding note is already carried by
          each opportunity card's own status text ("sent to your
          organisation"), so it isn't lost, just not duplicated up here
          at the cost of a layout shift between tabs. */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-[var(--app-text)] text-2xl font-bold">Discover</h1>
        {tab === 'received' && <p className="text-[var(--app-text-tertiary)] text-sm mt-0.5">Employers who've expressed interest in you</p>}
        {tab === 'tracking' && <p className="text-[var(--app-text-tertiary)] text-sm mt-0.5">Where each application actually stands</p>}
      </div>

      {/* Always rendered, every tab -- it used to only show for tabs
          other than "received", and hiding it there removed a whole
          row of height, which is exactly what made switching to
          Interest received visibly jump the content up. Search still
          does something real on every tab, including this one
          (filters by employer name client-side, below). */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-2 bg-[var(--app-surface)] border border-[var(--app-border-subtle)] rounded-2xl px-4 py-3">
          <Search className="w-4 h-4 text-[var(--app-text-tertiary)] flex-shrink-0" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'received' ? 'Search by employer…' : 'Search…'}
            className="flex-1 bg-transparent text-[var(--app-text)] text-sm placeholder-[#444] outline-none"
          />
          {search && <button onClick={() => setSearch('')}><X className="w-4 h-4 text-[var(--app-text-tertiary)]" /></button>}
        </div>
      </div>

      <div className="px-4 flex gap-2 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(t => (
          <button
            key={t.id} onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition ${
              tab === t.id ? 'bg-white text-black' : 'bg-[var(--app-surface)] text-[var(--app-text-secondary)] border border-[var(--app-border-subtle)]'
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
              <div key={i} className="bg-[var(--app-surface)] border border-[var(--app-border-subtle)] rounded-2xl p-4 h-28 animate-pulse" />
            ))}
          </div>
        ) : tab === 'explore' ? (
          work.length === 0 ? <EmptyState label="No public verified work matches yet — check back soon." /> : work.map(v => {
            const wi = v.submissions?.work_items
            const student = v.submissions?.student
            return (
              // Was a plain div -- tapping did nothing at all. Opens
              // the student's own profile (Verified is right there),
              // the same destination tapping a Feed author now goes to.
              <button
                key={v.id} onClick={() => router.push(student?.id === user?.id ? '/student/profile' : `/student/profile/${student?.id}`)}
                className="w-full text-left bg-[var(--app-surface)] border border-[var(--app-border-subtle)] rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold text-[var(--app-text-secondary)] uppercase tracking-wide">{TYPE_LABEL[wi?.type] || wi?.type}</span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-[#4ade80] flex-shrink-0"><BadgeCheck className="w-3.5 h-3.5" /> Verified</span>
                </div>
                <p className="text-[var(--app-text)] font-bold text-[15px] leading-snug mb-1">{wi?.title}</p>
                {wi?.description && <p className="text-[var(--app-text-secondary)] text-sm line-clamp-2 mb-3 leading-snug">{wi.description}</p>}
                <div className="flex items-center gap-2 pt-2 border-t border-[var(--app-border-subtle)]">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#3A2E24] to-[#241C15] flex items-center justify-center text-[var(--app-text)] font-bold text-[9px] flex-shrink-0">
                    {initials(student?.full_name)}
                  </div>
                  <p className="text-[var(--app-text-secondary)] text-xs">{student?.full_name} · verified {new Date(v.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                </div>
              </button>
            )
          })
        ) : tab === 'received' ? (
          (() => {
            const q = search.trim().toLowerCase()
            const filtered = q ? interest.filter(i => i.employer?.full_name?.toLowerCase().includes(q)) : interest
            if (interest.length === 0) return <EmptyState label="Nothing yet — when an employer's interested in your verified work, it'll show up here." />
            if (filtered.length === 0) return <EmptyState label={`No requests from an employer matching "${search}".`} />
            return filtered.map(i => (
            <div key={i.id} className="bg-[var(--app-surface)] border border-[var(--app-border-subtle)] rounded-2xl p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#252525] flex items-center justify-center text-[var(--app-text)] font-bold text-[11px] flex-shrink-0">
                  {initials(i.employer?.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-[var(--app-text)] font-bold text-sm truncate">{i.employer?.full_name || 'An employer'}</p>
                  <p className="text-[var(--app-text-tertiary)] text-xs">
                    {i.opportunity_label ? `${i.opportunity_label} · ` : ''}{new Date(i.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              {/* Was fetched but never shown -- the whole point of the
                  message is telling the student what the employer's
                  actually after before they accept or decline. */}
              {i.message && <p className="text-[var(--app-text-body)] text-sm leading-snug mb-3">{i.message}</p>}
              {i.status === 'pending' ? (
                <div className="flex gap-2">
                  <button onClick={() => respond(i.id, 'accepted')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-[var(--app-text)]">
                    <Check className="w-4 h-4" /> Accept
                  </button>
                  <button onClick={() => respond(i.id, 'declined')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-semibold bg-[#252525] text-[var(--app-text-secondary)] border border-[var(--app-border)]">
                    <Ban className="w-4 h-4" /> Decline
                  </button>
                </div>
              ) : (
                <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full ${
                  i.status === 'accepted' ? 'bg-[#123a24] text-[#4ade80]' : 'bg-white/5 text-[var(--app-text-tertiary)]'
                }`}>
                  {i.status === 'accepted' ? 'Accepted' : 'Declined'}
                </span>
              )}
            </div>
            ))
          })()
        ) : tab === 'tracking' ? (
          applications.length === 0 ? (
            <EmptyState label="Nothing yet — apply to a role or accept an employer's interest to start tracking it here." icon={<LineChart className="w-8 h-8 text-[var(--app-text-quaternary)] mb-2" />} />
          ) : applications.map(a => {
            const meta = STAGE_META[a.stage as ApplicationStage]
            return (
              <div key={a.id} className="bg-[var(--app-surface)] border border-[var(--app-border-subtle)] rounded-2xl p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#252525] flex items-center justify-center text-[var(--app-text)] font-bold text-[11px] flex-shrink-0">
                    {initials(a.employer?.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[var(--app-text)] font-bold text-sm truncate">{a.opportunity?.title || 'Direct interest'}</p>
                    <p className="text-[var(--app-text-secondary)] text-xs truncate">{a.employer?.full_name || 'An employer'}</p>
                  </div>
                  <span className="text-[11px] font-semibold px-3 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: meta.bg, color: meta.text }}>
                    {meta.label}
                  </span>
                </div>
                <p className="text-[var(--app-text-tertiary)] text-xs">Updated {new Date(a.stage_updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            )
          })
        ) : (
          opportunities.length === 0 ? <EmptyState label={`No ${tab === 'job' ? 'jobs' : tab === 'apprenticeship' ? 'apprenticeships' : 'internships'} posted yet.`} icon={<Briefcase className="w-8 h-8 text-[var(--app-text-quaternary)] mb-2" />} /> : opportunities.map(o => {
            const status = applicationByOpp[o.id]
            return (
              <div key={o.id} className="bg-[var(--app-surface)] border border-[var(--app-border-subtle)] rounded-2xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  {/* Real company logo when the employer's added one --
                      gradient-initials fallback otherwise, same as
                      every other avatar in the app. */}
                  {o.logo_path ? (
                    <img src={getAvatarUrl(o.logo_path) || ''} alt="" className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-[#252525] flex items-center justify-center text-[var(--app-text)] font-bold text-[16px] flex-shrink-0">
                      {initials(o.employer?.full_name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--app-text)] font-bold text-[17px] leading-tight">{o.title}</p>
                    {o.employer?.full_name && <p className="text-[var(--app-text-secondary)] text-sm">{o.employer.full_name}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {/* Brand orange, not green -- matches the real old
                      JobCard exactly (git show a07a8c2~1), not a generic
                      "money = green" default. */}
                  {o.salary && <p className="text-[#FF6B2B] font-bold text-sm">{o.salary}</p>}
                  {o.location && <p className="text-[var(--app-text-secondary)] text-sm">{o.salary ? '· ' : ''}{o.location}</p>}
                </div>
                {o.description && <p className="text-[var(--app-text-tertiary)] text-sm leading-relaxed line-clamp-2 mb-2">{o.description}</p>}
                {o.requirements && <p className="text-[var(--app-text-tertiary)] text-sm leading-relaxed line-clamp-2 mb-3"><span className="font-semibold text-[var(--app-text-secondary)]">Looking for: </span>{o.requirements}</p>}
                <div className="flex items-center gap-1 text-[var(--app-text-tertiary)] text-xs mb-3">
                  <Clock className="w-3 h-3" /> Posted {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </div>
                {status === 'pending' ? (
                  adult && stageByOpp[o.id] ? (
                    <div className="w-full text-center py-2.5 rounded-full text-sm font-semibold" style={{ backgroundColor: STAGE_META[stageByOpp[o.id]].bg, color: STAGE_META[stageByOpp[o.id]].text }}>
                      {STAGE_META[stageByOpp[o.id]].label}
                    </div>
                  ) : (
                    <div className="w-full text-center py-2.5 rounded-full text-sm font-semibold bg-white/5 text-[var(--app-text-secondary)]">
                      {adult ? 'Applied — pending' : 'Applied — sent to your organisation'}
                    </div>
                  )
                ) : status === 'accepted' ? (
                  <div className="flex items-center justify-center gap-1.5 w-full text-center py-2.5 rounded-full text-sm font-semibold bg-[#123a24] text-[#4ade80]">
                    <Check className="w-4 h-4" /> Accepted
                  </div>
                ) : status === 'declined' ? (
                  <div className="w-full text-center py-2.5 rounded-full text-sm font-semibold bg-white/5 text-[var(--app-text-tertiary)]">Declined</div>
                ) : (
                  <button
                    onClick={() => apply(o.id)} disabled={applying === o.id}
                    className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-full text-sm font-semibold bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-[var(--app-text)] disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" /> {applying === o.id ? 'Applying…' : 'Apply'}
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function EmptyState({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="text-center py-16">
      {icon ?? <Search className="w-8 h-8 text-[var(--app-text-quaternary)] mx-auto mb-3" />}
      <p className="text-[var(--app-text-tertiary)] text-sm">{label}</p>
    </div>
  )
}
