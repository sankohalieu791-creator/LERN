'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getUserProfile, followUser, unfollowUser, isFollowing,
  getUserVideos, getFeedback, incrementProfileViews,
  addFeedback, createNotification,
} from '@/lib/supabase'
import { sendPush } from '@/lib/push'
import { Grid3X3, Play, MessageSquare, ArrowLeft, Star, Loader2, Send } from 'lucide-react'
import Link from 'next/link'

function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center bg-[#1d9bf0] rounded-full flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24" fill="none" stroke="white"
        strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ width: size * 0.58, height: size * 0.58 }}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-[#333]'}`}
        />
      ))}
    </div>
  )
}

export default function UserProfilePage() {
  const { userId } = useParams()
  const { user } = useAuth()
  const router = useRouter()

  const [profile,       setProfile]       = useState<any>(null)
  const [videos,        setVideos]        = useState<any[]>([])
  const [feedback,      setFeedback]      = useState<any[]>([])
  const [following,     setFollowing]     = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [activeTab,     setActiveTab]     = useState<'posts' | 'feedback'>('posts')

  // Inline feedback form state (for instructors viewing someone else's profile)
  const [fbRating,      setFbRating]      = useState(0)
  const [fbText,        setFbText]        = useState('')
  const [fbSubmitting,  setFbSubmitting]  = useState(false)
  const [fbSubmitted,   setFbSubmitted]   = useState(false)

  const profileId  = userId as string
  const isOwnProfile = user?.id === profileId

  useEffect(() => {
    if (!profileId) return
    const load = async () => {
      setLoading(true)
      const [profileRes, videosRes, feedbackRes] = await Promise.all([
        getUserProfile(profileId),
        getUserVideos(profileId),
        getFeedback(profileId),
      ])
      setProfile(profileRes.data)
      setVideos(videosRes.data ?? [])
      setFeedback(feedbackRes.data ?? [])

      if (user && user.id !== profileId) {
        const { data: followed } = await isFollowing(user.id, profileId)
        setFollowing(!!followed)
        // Increment profile view count for this visitor
        try { await incrementProfileViews(profileId) } catch {}
      }
      setLoading(false)
    }
    load()
  }, [profileId, user])

  const handleFollow = async () => {
    if (!user || isOwnProfile || followLoading) return
    setFollowLoading(true)
    if (following) {
      await unfollowUser(user.id, profileId)
      setFollowing(false)
      setProfile((p: any) => ({ ...p, followers_count: Math.max(0, (p.followers_count || 0) - 1) }))
    } else {
      await followUser(user.id, profileId)
      setFollowing(true)
      setProfile((p: any) => ({ ...p, followers_count: (p.followers_count || 0) + 1 }))
    }
    setFollowLoading(false)
  }

  const canLeaveFeedback =
    user &&
    !isOwnProfile &&
    (user.account_type === 'employer' || user.account_type === 'instructor' ||
     (user as any).is_employer || (user as any).is_instructor)

  const handleSubmitFeedback = async () => {
    if (!user || fbRating === 0 || !fbText.trim()) return
    setFbSubmitting(true)
    try {
      await addFeedback(profileId, user.id, fbRating, fbText.trim())
      sendPush(profileId, '⭐ New feedback', `${(user as any).username ?? user.email?.split('@')[0]} gave you ${fbRating}-star feedback`, `/profile/${profileId}`)
      createNotification(profileId, 'feedback', '⭐ New feedback', `${(user as any).username ?? user.email?.split('@')[0]} gave you ${fbRating}-star feedback`, `/profile/${profileId}`)
      const { data: fresh } = await getFeedback(profileId)
      setFeedback(fresh ?? [])
      setFbRating(0); setFbText(''); setFbSubmitted(true)
    } finally {
      setFbSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
    </div>
  )

  if (!profile) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <p className="text-[#444] text-sm">User not found</p>
    </div>
  )

  const initial = profile.username?.[0]?.toUpperCase() ?? 'U'

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-24">

      {/* ── BACK HEADER ──────────────────────────────────────── */}
      <div className="sticky top-0 bg-[#0f0f0f] z-30 flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.05)]">
        <button onClick={() => router.back()} className="text-white p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="text-white font-bold text-base">{profile.username}</p>
      </div>

      {/* ── HEADER ROW ───────────────────────────────────────── */}
      <div className="px-4 pt-5 flex items-center gap-4 mb-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-2xl font-bold overflow-hidden flex-shrink-0">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            : initial}
        </div>

        <div className="flex flex-1 justify-around">
          {[
            { label: 'Posts',     value: videos.length               },
            { label: 'Followers', value: profile.followers_count ?? 0 },
            { label: 'Following', value: profile.following_count ?? 0 },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-white font-bold text-lg leading-none">{s.value.toLocaleString()}</p>
              <p className="text-[#555] text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── NAME + BADGE ─────────────────────────────────────── */}
      <div className="px-4 mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-white text-xl font-bold">{profile.username}</h1>
          {profile.verified && <VerifiedBadge size={18} />}
          <span className="text-[10px] font-bold bg-[#1e1e1e] text-[#888] border border-[rgba(255,255,255,0.08)] px-2 py-0.5 rounded-full uppercase">
            {profile.account_type ?? 'student'}
          </span>
        </div>
      </div>
      {profile.bio && (
        <p className="px-4 text-[#aaa] text-sm mb-3 leading-snug">{profile.bio}</p>
      )}

      {/* ── ACTION BUTTONS (only shown when viewing someone else) ── */}
      {!isOwnProfile && (
        <div className="px-4 flex gap-2 mb-5">
          <button
            onClick={handleFollow}
            disabled={followLoading || !user}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition active:scale-[0.98] ${
              following
                ? 'bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-white'
                : 'bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white'
            } disabled:opacity-40`}
          >
            {followLoading ? '…' : following ? 'Following' : 'Follow'}
          </button>

          {canLeaveFeedback && (
            <button
              onClick={() => setActiveTab('feedback')}
              className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#222] transition"
            >
              <MessageSquare className="w-4 h-4" />
              Feedback
            </button>
          )}
        </div>
      )}

      {/* ── TABS ─────────────────────────────────────────────── */}
      <div className="flex border-b border-[rgba(255,255,255,0.07)]">
        {[
          { id: 'posts',    icon: Grid3X3,      label: 'Posts'    },
          { id: 'feedback', icon: MessageSquare, label: 'Feedback' },
        ].map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'posts' | 'feedback')}
              className={`flex-1 flex justify-center py-3 border-b-2 transition-colors ${
                active ? 'border-white text-white' : 'border-transparent text-[#444] hover:text-[#777]'
              }`}
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        })}
      </div>

      {/* ── TAB CONTENT ──────────────────────────────────────── */}
      <div className="p-4">

        {/* POSTS */}
        {activeTab === 'posts' && (
          videos.length === 0 ? (
            <div className="text-center py-16">
              <Grid3X3 className="w-10 h-10 text-[#2a2a2a] mx-auto mb-3" />
              <p className="text-[#444] text-sm">No posts yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {videos.map(v => (
                <Link
                  key={v.id}
                  href={`/feed/${v.id}`}
                  className="relative aspect-square bg-[#1a1a1a] rounded-lg overflow-hidden group"
                >
                  {v.thumbnail_url
                    ? <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-[#333]" />
                      </div>
                  }
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <div className="flex items-center gap-1 text-white text-xs font-semibold">
                      <Play className="w-3.5 h-3.5 fill-white" />
                      {(v.views ?? 0).toLocaleString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* FEEDBACK */}
        {activeTab === 'feedback' && (
          <div>
            {/* Inline "Drop a feedback" form for instructors */}
            {canLeaveFeedback && (
              <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4 mb-4">
                {fbSubmitted ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-white font-bold">Feedback sent!</p>
                    <button onClick={() => setFbSubmitted(false)} className="text-[#555] text-xs mt-2">Leave another</button>
                  </div>
                ) : (
                  <>
                    <p className="text-[#888] text-xs font-bold uppercase tracking-wider mb-3">Drop a feedback</p>
                    {/* Stars */}
                    <div className="flex gap-2 mb-3">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setFbRating(n)} className="transition active:scale-90">
                          <Star className={`w-7 h-7 ${n <= fbRating ? 'fill-yellow-400 text-yellow-400' : 'text-[#333]'}`} />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={fbText}
                      onChange={e => setFbText(e.target.value)}
                      placeholder={`Share your experience with ${profile.username}…`}
                      rows={3}
                      className="w-full bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition resize-none mb-3"
                    />
                    <button
                      onClick={handleSubmitFeedback}
                      disabled={fbSubmitting || fbRating === 0 || !fbText.trim()}
                      className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98] transition"
                    >
                      <Send className="w-4 h-4" />
                      {fbSubmitting ? 'Sending…' : 'Send Feedback'}
                    </button>
                  </>
                )}
              </div>
            )}

            {feedback.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-10 h-10 text-[#2a2a2a] mx-auto mb-3" />
                <p className="text-[#444] text-sm">No feedback yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedback.map((f: any) => (
                  <div key={f.id} className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                          {f.users?.avatar_url
                            ? <img src={f.users.avatar_url} className="w-full h-full object-cover" />
                            : f.users?.username?.[0]?.toUpperCase() ?? 'E'
                          }
                        </div>
                        <p className="text-white text-sm font-semibold">{f.users?.username ?? 'Instructor'}</p>
                      </div>
                      <Stars rating={f.rating} />
                    </div>
                    <p className="text-[#777] text-sm leading-relaxed">{f.feedback_text}</p>
                    <p className="text-[#444] text-xs mt-2">
                      {new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
