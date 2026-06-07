'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search, MapPin, Users, X, Mail, Phone,
  Check, Loader2, Send, MessageCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { getUnreadMessageCount } from '@/lib/supabase'
import {
  getInstructors, getFollowingIds,
  followUser, unfollowUser,
  sendTrainingRequest, getMyTrainingRequests,
  createNotification, getOrCreateConversation,
} from '@/lib/supabase'
import { sendPush } from '@/lib/push'
import type { InstructorApplication } from '@/lib/types'

const ROLE_TABS = [
  { id: 'mentor',    label: 'Mentors'    },
  { id: 'coach',     label: 'Coaches'    },
  { id: 'teacher',   label: 'Teachers'   },
  { id: 'professor', label: 'Professors' },
] as const
type TabId = typeof ROLE_TABS[number]['id'] | 'request'

const ROLE_COLOUR: Record<string, string> = {
  coach: 'bg-orange-500', professor: 'bg-blue-600',
  teacher: 'bg-green-600', mentor: 'bg-purple-600',
}

function getBadge(count: number) {
  if (count >= 50000) return { label: 'TOP MENTOR 2025', icon: '🏆' }
  if (count >= 5000)  return { label: 'RISING MENTOR',   icon: '🏅' }
  return null
}

function fmtFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function RolePill({ role }: { role: string }) {
  return (
    <span className={`${ROLE_COLOUR[role] ?? 'bg-gray-600'} text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide`}>
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
    <div className="rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {u?.avatar_url
        ? <img src={u.avatar_url} alt={app.full_name} className="w-full h-full object-cover" />
        : letter}
    </div>
  )
}

function InstructorCard({
  app, isFollowed, onFollow, onContact, onRequest, requestMode, alreadyRequested, requestStatus,
}: {
  app: InstructorApplication
  isFollowed: boolean
  onFollow: () => void
  onContact?: () => void
  onRequest?: () => void
  requestMode?: boolean
  alreadyRequested?: boolean
  requestStatus?: string
}) {
  const router = useRouter()
  const u = app.users
  const badge = getBadge(u?.followers_count ?? 0)

  return (
    <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <button onClick={() => app.user_id && router.push(`/profile/${app.user_id}`)} className="flex-shrink-0">
          <Avatar app={app} size={56} />
        </button>
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
              <span>{[app.location, app.experience_years && `${app.experience_years} yrs exp`].filter(Boolean).join(' · ')}</span>
            </div>
          )}
        </div>
      </div>

      {badge && (
        <div className="inline-flex items-center gap-1.5 bg-[#2a2000] border border-[#5a3800] rounded-full px-3 py-1 mb-3">
          <span className="text-xs">{badge.icon}</span>
          <span className="text-[#d4a012] text-[10px] font-bold tracking-wider">{badge.label}</span>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 text-sm">
        <div className="flex items-center gap-1.5 text-[#888]">
          <Users className="w-3.5 h-3.5" />
          <span className="font-semibold text-white">{fmtFollowers(u?.followers_count ?? 0)}</span>
          <span>followers</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onFollow}
          className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition ${
            isFollowed
              ? 'bg-[#2a2a2a] text-[#888] border border-[rgba(255,255,255,0.1)]'
              : 'bg-white text-black'
          }`}
        >
          {isFollowed ? 'Following' : 'Follow'}
        </button>

        {requestMode ? (
          <button
            onClick={onRequest}
            disabled={alreadyRequested}
            className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition ${
              requestStatus === 'accepted'
                ? 'bg-green-600/20 text-green-400 border border-green-600/40 cursor-default'
                : alreadyRequested
                  ? 'bg-[#252525] text-[#555] border border-[rgba(255,255,255,0.06)] cursor-default'
                  : 'bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white'
            }`}
          >
            {requestStatus === 'accepted' ? '✓ Accepted' : alreadyRequested ? 'Requested' : 'Request'}
          </button>
        ) : (
          <button
            onClick={onContact}
            className="flex-1 py-2.5 rounded-full text-sm font-semibold bg-[#252525] text-white border border-[rgba(255,255,255,0.1)] hover:bg-[#2e2e2e] transition"
          >
            Contact
          </button>
        )}
      </div>
    </div>
  )
}

function RequestSheet({
  app, onClose, onSent,
}: {
  app: InstructorApplication
  onClose: () => void
  onSent: () => void
}) {
  const { user } = useAuth()
  const [type, setType]       = useState<'training' | 'mentorship'>('training')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)

  const handleSend = async () => {
    if (!user || !message.trim() || !app.user_id) return
    setSending(true)
    const { error } = await sendTrainingRequest(user.id, app.user_id, type, message.trim())
    setSending(false)
    if (!error) {
      sendPush(app.user_id, '📩 New request', `${(user as any).username} sent you a ${type} request`, '/profile/me')
      createNotification(app.user_id, 'request', '📩 New request', `${(user as any).username} sent you a ${type} request`, '/profile/me')
      setSent(true)
      onSent()
      setTimeout(onClose, 1800)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!sent ? onClose : undefined} />
      <div className="relative bg-[#141414] rounded-t-3xl overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-[#333] rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.07)]">
          <h2 className="text-white font-bold text-lg">Request 1-to-1</h2>
          <button onClick={onClose} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="mx-5 mt-4 mb-4 flex items-center gap-3 bg-[#1e1e1e] border border-[rgba(255,255,255,0.07)] rounded-2xl p-3">
          <Avatar app={app} size={44} />
          <div>
            <p className="text-white font-bold text-sm">{app.full_name}</p>
            <p className="text-[#888] text-xs">{app.topic}</p>
          </div>
        </div>

        {sent ? (
          <div className="px-5 pb-10 text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-white" />
            </div>
            <p className="text-white font-bold text-lg">Request sent!</p>
            <p className="text-[#555] text-sm mt-1">{app.full_name?.split(' ')[0]} will be notified.</p>
          </div>
        ) : (
          <div className="px-5 pb-6">
            <p className="text-[#555] text-[11px] font-bold uppercase tracking-widest mb-3">Type</p>
            <div className="flex gap-3 mb-5">
              {(['training', 'mentorship'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-3 rounded-2xl text-sm font-semibold border transition ${
                    type === t
                      ? 'bg-[#FF6B2B]/15 border-[#FF6B2B] text-[#FF6B2B]'
                      : 'bg-[#1e1e1e] border-[rgba(255,255,255,0.07)] text-[#888]'
                  }`}
                >
                  {t === 'training' ? '🎯 1-to-1 Training' : '🤝 Mentorship'}
                </button>
              ))}
            </div>

            <p className="text-[#555] text-[11px] font-bold uppercase tracking-widest mb-2">Message</p>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={`Tell ${app.full_name?.split(' ')[0] ?? 'them'} what you want to work on…`}
              rows={4}
              className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition resize-none mb-5"
            />

            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending…' : 'Send request'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ContactSheet({
  app, onClose, isFollowed, onFollow,
}: {
  app: InstructorApplication
  onClose: () => void
  isFollowed: boolean
  onFollow: () => void
}) {
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const u = app.users
  const badge = getBadge(u?.followers_count ?? 0)
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#141414] rounded-t-3xl flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Handle + close */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-4 pb-2">
          <div className="w-10 h-1 bg-[#333] rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
          <div />
          <button onClick={onClose} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center ml-auto">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Avatar row */}
        <div className="flex-shrink-0 px-5 pb-3 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] border-2 border-[#2a2a2a] flex items-center justify-center text-white text-xl font-bold overflow-hidden flex-shrink-0">
            {u?.avatar_url
              ? <img src={u.avatar_url} alt={app.full_name} className="w-full h-full object-cover" />
              : (app.full_name?.[0] || '?').toUpperCase()
            }
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white text-lg font-bold truncate">{app.full_name}</h2>
              {u?.verified && <VerifiedTick size={18} />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <RolePill role={app.role_type} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>

          <div className="px-5">
            <p className="text-[#888] text-sm mb-1">{app.topic}</p>
            {(app.location || app.experience_years) && (
              <div className="flex items-center gap-1 text-[#555] text-xs mb-3">
                <MapPin className="w-3 h-3" />
                <span>{[app.location, app.experience_years && `${app.experience_years} yrs exp`].filter(Boolean).join(' · ')}</span>
              </div>
            )}
            {badge && (
              <div className="inline-flex items-center gap-1.5 bg-[#2a2000] border border-[#5a3800] rounded-full px-3 py-1 mb-4">
                <span className="text-xs">{badge.icon}</span>
                <span className="text-[#d4a012] text-[10px] font-bold tracking-wider">{badge.label}</span>
              </div>
            )}
            <div className="flex items-center gap-3 mb-5 text-sm text-[#888]">
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span className="font-semibold text-white">{fmtFollowers(u?.followers_count ?? 0)}</span>
                <span>followers</span>
              </div>
            </div>
            <div className="flex gap-2 mb-5">
              <button
                onClick={onFollow}
                className={`flex-1 py-3 rounded-full text-sm font-bold transition ${
                  isFollowed ? 'bg-[#2a2a2a] text-[#888] border border-[rgba(255,255,255,0.1)]' : 'bg-white text-black'
                }`}
              >
                {isFollowed ? 'Following' : 'Follow'}
              </button>
              {app.user_id && currentUser && (
                <button
                  onClick={async () => {
                    const { data } = await getOrCreateConversation(currentUser.id, app.user_id)
                    if (data?.id) { onClose(); router.push(`/messages/${data.id}`) }
                  }}
                  className="flex items-center gap-1.5 bg-[#1e1e1e] border border-[rgba(255,255,255,0.1)] text-white px-4 py-3 rounded-full text-sm font-bold"
                >
                  <MessageCircle className="w-4 h-4" />
                  Message
                </button>
              )}
            </div>
            {(app.contact_email || app.contact_phone) ? (
              <div>
                <p className="text-[#555] text-[11px] font-bold uppercase tracking-widest mb-3">Contact</p>
                <div className="space-y-2">
                  {app.contact_email && (
                    <ContactRow icon={<Mail className="w-4 h-4 text-[#888]" />} label="Email" value={app.contact_email} copyKey="email" copied={copied} onCopy={copy} />
                  )}
                  {app.contact_phone && (
                    <ContactRow icon={<Phone className="w-4 h-4 text-[#888]" />} label="Phone" value={app.contact_phone} copyKey="phone" copied={copied} onCopy={copy} />
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
  icon: React.ReactNode; label: string; value: string
  copyKey: string; copied: string | null; onCopy: (v: string, k: string) => void
}) {
  return (
    <div className="flex items-center gap-3 bg-[#1e1e1e] border border-[rgba(255,255,255,0.06)] rounded-2xl px-4 py-3.5">
      <div className="w-9 h-9 rounded-full bg-[#252525] flex items-center justify-center flex-shrink-0">{icon}</div>
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

export default function DiscoveryPage() {
  const { user } = useAuth()
  const [activeTab,     setActiveTab]     = useState<TabId>('mentor')
  const [search,        setSearch]        = useState('')
  const [instructors,   setInstructors]   = useState<InstructorApplication[]>([])
  const [loading,       setLoading]       = useState(false)
  const [followingIds,  setFollowingIds]  = useState<Set<string>>(new Set())
  const [requestedIds,  setRequestedIds]  = useState<Map<string, string>>(new Map())
  const [contact,       setContact]       = useState<InstructorApplication | null>(null)
  const [requestTarget, setRequestTarget] = useState<InstructorApplication | null>(null)
  const [unreadMsgs,    setUnreadMsgs]    = useState(0)

  useEffect(() => {
    if (!user) return
    getUnreadMessageCount(user.id).then(setUnreadMsgs)
  }, [user])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const roleFilter = activeTab === 'request' ? undefined : activeTab
      const [{ data }, followIds, reqData] = await Promise.all([
        getInstructors(roleFilter),
        user ? getFollowingIds(user.id) : Promise.resolve([] as string[]),
        user ? getMyTrainingRequests(user.id) : Promise.resolve({ data: null }),
      ])
      setInstructors((data as any[]) ?? [])
      setFollowingIds(new Set(followIds))
      if (reqData.data) setRequestedIds(new Map(reqData.data.map((r: any) => [r.to_instructor_id, r.status ?? 'pending'])))
      setLoading(false)
    }
    load()
  }, [activeTab, user])

  const handleFollow = useCallback(async (targetId: string | undefined) => {
    if (!user || !targetId) return
    // Read current state inside the setter to avoid stale closure
    let wasFollowing = false
    setFollowingIds(prev => {
      wasFollowing = prev.has(targetId)
      const next = new Set(prev)
      wasFollowing ? next.delete(targetId) : next.add(targetId)
      return next
    })
    // Fire API based on the state we just read
    if (wasFollowing) {
      await unfollowUser(user.id, targetId)
    } else {
      await followUser(user.id, targetId)
    }
  }, [user])

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

  const allTabs: { id: TabId; label: string }[] = [
    ...ROLE_TABS,
    { id: 'request', label: '✉ Request' },
  ]

  return (
    <>
    <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      <div className="flex-shrink-0">
        <div className="flex items-start justify-between px-4 pt-4 pb-3">
          <div>
            <h1 className="text-white text-2xl font-bold">Discover</h1>
            {activeTab === 'request' && (
              <p className="text-[#555] text-sm mt-0.5">Send a 1-to-1 training or mentorship request</p>
            )}
          </div>
          <Link href="/messages" className="relative mt-1">
            <MessageCircle className="w-6 h-6 text-[#888]" />
            {unreadMsgs > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF6B2B] rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                {unreadMsgs > 9 ? '9+' : unreadMsgs}
              </span>
            )}
          </Link>
        </div>

        <div className="px-4 mb-3">
          <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3">
            <Search className="w-4 h-4 text-[#555] flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={activeTab === 'request' ? 'Search instructors…' : 'Search mentors…'}
              className="flex-1 bg-transparent text-white text-sm placeholder-[#444] outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X className="w-4 h-4 text-[#555]" />
              </button>
            )}
          </div>
        </div>

        <div className="px-4 flex gap-2 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {allTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition ${
                activeTab === t.id
                  ? t.id === 'request'
                    ? 'bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white'
                    : 'bg-white text-black'
                  : 'bg-[#1a1a1a] text-[#888] border border-[rgba(255,255,255,0.08)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 space-y-4 pt-1"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#444] text-sm">
              {activeTab === 'request' ? 'No instructors available yet' : `No ${activeTab}s found yet`}
            </p>
            <p className="text-[#333] text-xs mt-1">Apply in Settings → Apply to be an instructor</p>
          </div>
        ) : (
          filtered.map(app => (
            <InstructorCard
              key={app.id}
              app={app}
              isFollowed={followingIds.has(app.user_id ?? '')}
              onFollow={() => handleFollow(app.user_id)}
              onContact={activeTab !== 'request' ? () => setContact(app) : undefined}
              onRequest={activeTab === 'request' ? () => setRequestTarget(app) : undefined}
              requestMode={activeTab === 'request'}
              alreadyRequested={requestedIds.has(app.user_id)}
              requestStatus={requestedIds.get(app.user_id)}
            />
          ))
        )}
      </div>
    </div>

    {contact && (
      <ContactSheet
        app={contact}
        onClose={() => setContact(null)}
        isFollowed={followingIds.has(contact.users?.id ?? '')}
        onFollow={() => handleFollow(contact.users?.id)}
      />
    )}

    {requestTarget && (
      <RequestSheet
        app={requestTarget}
        onClose={() => setRequestTarget(null)}
        onSent={() => setRequestedIds(prev => new Map([...prev, [requestTarget.user_id, 'pending']]))}
      />
    )}
    </>
  )
}