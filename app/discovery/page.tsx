'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search, MapPin, Users,
  X, Mail, Phone, Check, Loader2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getInstructors, getFollowingIds,
  followUser, unfollowUser,
} from '@/lib/supabase'
import type { InstructorApplication } from '@/lib/types'

// ── Role tabs ─────────────────────────────────────────────────
const TABS = [
  { id: 'mentor',    label: 'Mentors'    },
  { id: 'coach',     label: 'Coaches'    },
  { id: 'teacher',   label: 'Teachers'   },
  { id: 'professor', label: 'Professors' },
] as const
type RoleId = typeof TABS[number]['id']

// ── Badge logic ───────────────────────────────────────────────
function getBadge(count: number) {
  if (count >= 50000) return { label: 'TOP MENTOR 2025', icon: '🏆' }
  if (count >= 5000)  return { label: 'RISING MENTOR',   icon: '🏅' }
  return null
}

// ── Role badge colours ────────────────────────────────────────
const ROLE_COLOUR: Record<string, string> = {
  coach:     'bg-orange-500',
  professor: 'bg-blue-600',
  teacher:   'bg-green-600',
  mentor:    'bg-purple-600',
}

function RolePill({ role }: { role: string }) {
  const bg = ROLE_COLOUR[role] ?? 'bg-gray-600'
  return (
    <span className={`${bg} text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide`}>
      {role}
    </span>
  )
}

function VerifiedTick({ size = 16 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center bg-[#1d9bf0] rounded-full flex-shrink-0"
      style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ width: size * 0.58, height: size * 0.58 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
}

function Avatar({ app, size = 56 }: { app: InstructorApplication; size?: number }) {
  const u = app.users
  const letter = (app.full_name?.[0] || u?.username?.[0] || '?').toUpperCase()
  return (
    <div
      className="rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {u?.avatar_url
        ? <img src={u.avatar_url} alt={app.full_name} className="w-full h-full object-cover" />
        : letter}
    </div>
  )
}

function fmtFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ── Instructor card ───────────────────────────────────────────
function InstructorCard({
  app, isFollowed, onFollow, onContact,
}: {
  app: InstructorApplication
  isFollowed: boolean
  onFollow: () => void
  onContact: () => void
}) {
  const u = app.users
  const badge = getBadge(u?.followers_count ?? 0)

  return (
    <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4">
      {/* Top row */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar app={app} size={56} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <p className="text-white font-bold text-base leading-tight">{app.full_name}</p>
            {u?.verified && <VerifiedTick size={16} />}
            <RolePill role={app.role_type} />
          </div>
          <p className="text-[#888] text-xs line-clamp-1">{app.topic}</p>
          {(app.location || app.experience_years) && (
            <div className="flex items-center gap-1 text-[#555] text-xs mt-0.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span>
                {[app.location, app.experience_years && `${app.experience_years} yrs experience`]
                  .filter(Boolean).join(' · ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Badge */}
      {badge && (
        <div className="inline-flex items-center gap-1.5 bg-[#2a2000] border border-[#5a3800] rounded-full px-3 py-1 mb-3">
          <span className="text-xs">{badge.icon}</span>
          <span className="text-[#d4a012] text-[10px] font-bold tracking-wider">{badge.label}</span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 mb-4 text-sm">
        <div className="flex items-center gap-1.5 text-[#888]">
          <Users className="w-3.5 h-3.5" />
          <span className="font-semibold text-white">{fmtFollowers(u?.followers_count ?? 0)}</span>
          <span>followers</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onFollow}
          className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition ${
            isFollowed
              ? 'bg-[#2a2a2a] text-[#888] border border-[rgba(255,255,255,0.1)]'
              : 'bg-white text-black hover:bg-[#eee]'
          }`}
        >
          {isFollowed ? 'Following' : 'Follow'}
        </button>
        <button
          onClick={onContact}
          className="flex-1 py-2.5 rounded-full text-sm font-semibold bg-[#252525] text-white border border-[rgba(255,255,255,0.1)] hover:bg-[#2e2e2e] transition"
        >
          Contact
        </button>
      </div>
    </div>
  )
}

// ── Contact sheet ─────────────────────────────────────────────
function ContactSheet({
  app, onClose, isFollowed, onFollow,
}: {
  app: InstructorApplication
  onClose: () => void
  isFollowed: boolean
  onFollow: () => void
}) {
  const u = app.users
  const badge = getBadge(u?.followers_count ?? 0)
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#141414] rounded-t-3xl overflow-hidden max-h-[88vh]">
        {/* Gradient banner */}
        <div className="h-28 bg-gradient-to-r from-[#FF6B2B] via-[#E91E8C] to-[#7C3AED] relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-black/30 rounded-full flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto pb-10">
          {/* Avatar overlapping banner */}
          <div className="px-5 -mt-10 mb-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] border-4 border-[#141414] flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
              {u?.avatar_url
                ? <img src={u.avatar_url} alt={app.full_name} className="w-full h-full object-cover" />
                : (app.full_name?.[0] || '?').toUpperCase()}
            </div>
          </div>

          <div className="px-5">
            {/* Name + badges */}
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h2 className="text-white text-xl font-bold">{app.full_name}</h2>
              {u?.verified && <VerifiedTick size={20} />}
              <RolePill role={app.role_type} />
            </div>

            <p className="text-[#888] text-sm mb-1">{app.topic}</p>

            {(app.location || app.experience_years) && (
              <div className="flex items-center gap-1 text-[#555] text-xs mb-3">
                <MapPin className="w-3 h-3" />
                <span>{[app.location, app.experience_years && `${app.experience_years} yrs experience`].filter(Boolean).join(' · ')}</span>
              </div>
            )}

            {badge && (
              <div className="inline-flex items-center gap-1.5 bg-[#2a2000] border border-[#5a3800] rounded-full px-3 py-1 mb-4">
                <span className="text-xs">{badge.icon}</span>
                <span className="text-[#d4a012] text-[10px] font-bold tracking-wider">{badge.label}</span>
              </div>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-3 mb-6 text-sm text-[#888]">
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span className="font-semibold text-white">{fmtFollowers(u?.followers_count ?? 0)}</span>
                <span>followers</span>
              </div>
            </div>

            {/* Follow button */}
            <button
              onClick={onFollow}
              className={`w-full py-3 rounded-full text-sm font-bold mb-5 transition ${
                isFollowed
                  ? 'bg-[#2a2a2a] text-[#888] border border-[rgba(255,255,255,0.1)]'
                  : 'bg-white text-black hover:bg-[#eee]'
              }`}
            >
              {isFollowed ? 'Following' : 'Follow'}
            </button>

            {/* CONTACT */}
            {(app.contact_email || app.contact_phone) ? (
              <div>
                <p className="text-[#555] text-[11px] font-bold uppercase tracking-widest mb-3">Contact</p>
                <div className="space-y-2">
                  {app.contact_email && (
                    <ContactRow
                      icon={<Mail className="w-4 h-4 text-[#888]" />}
                      label="Email"
                      value={app.contact_email}
                      copyKey="email"
                      copied={copied}
                      onCopy={copy}
                    />
                  )}
                  {app.contact_phone && (
                    <ContactRow
                      icon={<Phone className="w-4 h-4 text-[#888]" />}
                      label="Phone"
                      value={app.contact_phone}
                      copyKey="phone"
                      copied={copied}
                      onCopy={copy}
                    />
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[#444] text-sm text-center py-4">No contact details provided</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactRow({ icon, label, value, copyKey, copied, onCopy }: {
  icon: React.ReactNode
  label: string
  value: string
  copyKey: string
  copied: string | null
  onCopy: (v: string, k: string) => void
}) {
  return (
    <div className="flex items-center gap-3 bg-[#1e1e1e] border border-[rgba(255,255,255,0.06)] rounded-2xl px-4 py-3.5">
      <div className="w-9 h-9 rounded-full bg-[#252525] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#555] text-xs">{label}</p>
        <p className="text-white text-sm font-medium truncate">{value}</p>
      </div>
      <button onClick={() => onCopy(value, copyKey)} className="text-[#FF6B2B] text-xs font-semibold flex-shrink-0 flex items-center gap-1">
        {copied === copyKey ? <Check className="w-4 h-4 text-green-400" /> : 'Copy'}
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function DiscoveryPage() {
  const { user } = useAuth()
  const [activeTab,   setActiveTab]   = useState<RoleId>('mentor')
  const [search,      setSearch]      = useState('')
  const [instructors, setInstructors] = useState<InstructorApplication[]>([])
  const [loading,     setLoading]     = useState(false)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [contact,     setContact]     = useState<InstructorApplication | null>(null)

  // Load instructors whenever tab changes
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await getInstructors(activeTab)
      setInstructors((data as any[]) ?? [])
      setLoading(false)
    }
    load()
  }, [activeTab])

  // Load which users the current user already follows
  useEffect(() => {
    if (!user) return
    getFollowingIds(user.id).then(ids => setFollowingIds(new Set(ids)))
  }, [user])

  const handleFollow = useCallback(async (targetId: string | undefined) => {
    if (!user || !targetId) return
    const next = new Set(followingIds)
    if (next.has(targetId)) {
      await unfollowUser(user.id, targetId)
      next.delete(targetId)
    } else {
      await followUser(user.id, targetId)
      next.add(targetId)
    }
    setFollowingIds(next)
  }, [user, followingIds])

  const filtered = instructors.filter(a => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      a.full_name?.toLowerCase().includes(q) ||
      a.topic?.toLowerCase().includes(q) ||
      a.location?.toLowerCase().includes(q) ||
      a.users?.username?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-24">

      {/* HEADER */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-white text-2xl font-bold">Discover</h1>
      </div>

      {/* SEARCH */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3">
          <Search className="w-4 h-4 text-[#555] flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search mentors…"
            className="flex-1 bg-transparent text-white text-sm placeholder-[#444] outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X className="w-4 h-4 text-[#555]" />
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="px-4 flex gap-2 mb-5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition ${
              activeTab === t.id
                ? 'bg-white text-black'
                : 'bg-[#1a1a1a] text-[#888] border border-[rgba(255,255,255,0.08)] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CARDS */}
      <div className="px-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#444] text-sm capitalize">No {activeTab}s found yet</p>
            <p className="text-[#333] text-xs mt-1">Apply in Settings → Apply to be an instructor</p>
          </div>
        ) : (
          filtered.map(app => (
            <InstructorCard
              key={app.id}
              app={app}
              isFollowed={followingIds.has(app.users?.id ?? '')}
              onFollow={() => handleFollow(app.users?.id)}
              onContact={() => setContact(app)}
            />
          ))
        )}
      </div>

      {/* CONTACT SHEET */}
      {contact && (
        <ContactSheet
          app={contact}
          onClose={() => setContact(null)}
          isFollowed={followingIds.has(contact.users?.id ?? '')}
          onFollow={() => handleFollow(contact.users?.id)}
        />
      )}
    </div>
  )
}
