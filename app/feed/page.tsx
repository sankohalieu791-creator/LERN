'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Bell, ThumbsUp, MessageCircle, Share2, X, Send, Play } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getVideos, likeVideo, unlikeVideo, hasUserLiked,
  followUser, unfollowUser, isFollowing,
  getComments, addComment, getNotifications,
} from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

// ── helpers ───────────────────────────────────────────────────
function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center bg-[#1d9bf0] rounded-full flex-shrink-0"
      style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ width: size * 0.58, height: size * 0.58 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
}

const SUBJECT_STYLES: Record<string, string> = {
  TYPESCRIPT: 'bg-blue-900/70 text-blue-200',
  JAVASCRIPT: 'bg-yellow-900/70 text-yellow-200',
  REACT:      'bg-cyan-900/70 text-cyan-200',
  PYTHON:     'bg-green-900/70 text-green-200',
  FITNESS:    'bg-orange-900/70 text-orange-200',
  MUSIC:      'bg-purple-900/70 text-purple-200',
  BUSINESS:   'bg-slate-700/70 text-slate-200',
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K'
  return String(n)
}

// ── page ──────────────────────────────────────────────────────
export default function FeedPage() {
  const { user } = useAuth()

  const [videos,        setVideos]        = useState<any[]>([])
  const [loading,       setLoading]       = useState(true)
  const [userLikes,     setUserLikes]     = useState<Set<string>>(new Set())
  const [following,     setFollowing]     = useState<Set<string>>(new Set())
  const [selectedVideo, setSelectedVideo] = useState<any>(null)
  const [searchOpen,    setSearchOpen]    = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [notifCount,    setNotifCount]    = useState(0)

  // Comments
  const [commentVideoId,  setCommentVideoId]  = useState<string | null>(null)
  const [comments,        setComments]        = useState<any[]>([])
  const [newComment,      setNewComment]      = useState('')
  const [commentLoading,  setCommentLoading]  = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await getVideos()
      const vids = data || []
      setVideos(vids)
      if (user) {
        const [likes, follows, notifs] = await Promise.all([
          Promise.all(vids.map(async (v: any) => {
            const { data: liked } = await hasUserLiked(v.id, user.id)
            return liked ? v.id : null
          })),
          Promise.all(vids.map(async (v: any) => {
            if (v.user_id === user.id) return null
            const { data: followed } = await isFollowing(user.id, v.user_id)
            return followed ? v.user_id : null
          })),
          getNotifications(user.id),
        ])
        setUserLikes(new Set(likes.filter(Boolean) as string[]))
        setFollowing(new Set(follows.filter(Boolean) as string[]))
        setNotifCount((notifs.data || []).filter((n: any) => !n.read).length)
      }
      setLoading(false)
    }
    load()
  }, [user])

  const openVideo = async (video: any) => {
    setSelectedVideo(video)
    // Increment view count in DB + local state
    try {
      await supabase.rpc('increment_video_views', { p_video_id: video.id })
      setVideos(vs => vs.map(v => v.id === video.id ? { ...v, views: v.views + 1 } : v))
    } catch {}
  }

  const handleLike = async (videoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!user) return
    if (userLikes.has(videoId)) {
      await unlikeVideo(videoId, user.id)
      setUserLikes(p => { const s = new Set(p); s.delete(videoId); return s })
      setVideos(vs => vs.map(v => v.id === videoId ? { ...v, likes_count: Math.max(0, v.likes_count - 1) } : v))
      if (selectedVideo?.id === videoId) setSelectedVideo((v: any) => ({ ...v, likes_count: Math.max(0, v.likes_count - 1) }))
    } else {
      await likeVideo(videoId, user.id)
      setUserLikes(p => new Set([...p, videoId]))
      setVideos(vs => vs.map(v => v.id === videoId ? { ...v, likes_count: v.likes_count + 1 } : v))
      if (selectedVideo?.id === videoId) setSelectedVideo((v: any) => ({ ...v, likes_count: v.likes_count + 1 }))
    }
  }

  const handleFollow = async (userId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!user || userId === user.id) return
    if (following.has(userId)) {
      await unfollowUser(user.id, userId)
      setFollowing(p => { const s = new Set(p); s.delete(userId); return s })
    } else {
      await followUser(user.id, userId)
      setFollowing(p => new Set([...p, userId]))
    }
  }

  const openComments = async (videoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setCommentVideoId(videoId)
    setCommentLoading(true)
    const { data } = await getComments(videoId)
    setComments(data || [])
    setCommentLoading(false)
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newComment.trim() || !commentVideoId) return
    await addComment(commentVideoId, user.id, newComment.trim())
    setNewComment('')
    const { data } = await getComments(commentVideoId)
    setComments(data || [])
    setVideos(vs => vs.map(v => v.id === commentVideoId ? { ...v, comments_count: v.comments_count + 1 } : v))
  }

  const filteredVideos = searchQuery.trim()
    ? videos.filter(v =>
        v.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.users?.username?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : videos

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#333] border-t-white rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-20">

      {/* ── HEADER ──────────────────────────────────────────── */}
      <div className="sticky top-0 bg-[#0f0f0f] z-30 border-b border-[rgba(255,255,255,0.05)]">
        {searchOpen ? (
          <div className="px-4 py-3 flex items-center gap-3">
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search videos…"
              autoFocus
              className="flex-1 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-full px-4 py-2.5 text-white text-sm placeholder-[#444] outline-none"
            />
            <button onClick={() => { setSearchOpen(false); setSearchQuery('') }} className="text-[#888] text-sm font-semibold">
              Cancel
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-white font-black text-xl tracking-tight">LERN</span>
            <div className="flex items-center gap-3">
              <button onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50) }}>
                <Search className="w-5 h-5 text-[#888] hover:text-white transition" />
              </button>
              <button className="relative">
                <Bell className="w-5 h-5 text-[#888] hover:text-white transition" />
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── VIDEO CARDS ─────────────────────────────────────── */}
      {filteredVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-4">
            <Play className="w-7 h-7 text-[#333]" />
          </div>
          <p className="text-white font-bold text-lg mb-2">
            {searchQuery ? 'No results' : 'No posts yet'}
          </p>
          <p className="text-[#444] text-sm">
            {searchQuery ? 'Try a different search' : 'Be the first to post a video'}
          </p>
        </div>
      ) : (
        filteredVideos.map(video => (
          <article
            key={video.id}
            onClick={() => openVideo(video)}
            className="cursor-pointer border-b border-[rgba(255,255,255,0.04)] pb-2"
          >
            {/* THUMBNAIL */}
            <div className="relative w-full aspect-video bg-[#1a1a1a] overflow-hidden">
              {video.thumbnail_url
                ? <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white/50 ml-0.5" />
                    </div>
                  </div>
              }
              {/* tags */}
              <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded ${SUBJECT_STYLES[video.subject] ?? 'bg-[#252525] text-[#888]'}`}>
                {video.subject}
              </span>
              <span className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                {video.duration}
              </span>
              {/* play overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition bg-black/20">
                <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </div>
              </div>
            </div>

            {/* BODY */}
            <div className="px-4 pt-3 pb-1">
              <h3 className="text-white font-bold text-[15px] leading-snug mb-2">{video.title}</h3>

              {/* INSTRUCTOR */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                    {video.users?.avatar_url
                      ? <img src={video.users.avatar_url} className="w-full h-full object-cover" />
                      : video.users?.username?.[0]?.toUpperCase()
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-semibold flex items-center gap-1">
                      {video.users?.username}
                      {video.users?.verified && <VerifiedBadge size={12} />}
                    </p>
                    {video.users?.title && <p className="text-[#555] text-[10px] truncate">{video.users.title}</p>}
                  </div>
                </div>
                {user?.id !== video.user_id && (
                  <button
                    onClick={e => handleFollow(video.user_id, e)}
                    className={`text-xs font-bold px-3 py-1 rounded-full border flex-shrink-0 transition ${
                      following.has(video.user_id)
                        ? 'border-[rgba(255,255,255,0.1)] text-[#555]'
                        : 'border-[rgba(255,255,255,0.2)] text-white hover:bg-white/5'
                    }`}
                  >
                    {following.has(video.user_id) ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>

              {video.description && (
                <p className="text-[#555] text-xs leading-relaxed mb-2 line-clamp-2">{video.description}</p>
              )}

              {/* STATS + ACTIONS */}
              <div className="flex items-center justify-between py-1">
                <span className="text-[#444] text-xs">{fmt(video.views)} views · {video.duration}</span>
                <div className="flex items-center gap-4">
                  <button onClick={e => handleLike(video.id, e)} className="flex items-center gap-1.5 active:scale-90 transition" aria-label="Like">
                    <ThumbsUp
                      className="w-4 h-4"
                      fill={userLikes.has(video.id) ? '#FF6B2B' : 'none'}
                      color={userLikes.has(video.id) ? '#FF6B2B' : '#555'}
                      strokeWidth={1.5}
                    />
                    <span className={`text-xs font-medium ${userLikes.has(video.id) ? 'text-[#FF6B2B]' : 'text-[#555]'}`}>
                      {fmt(video.likes_count)}
                    </span>
                  </button>
                  <button onClick={e => openComments(video.id, e)} className="flex items-center gap-1.5 text-[#555] hover:text-white transition active:scale-90" aria-label="Comment">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-xs font-medium">{fmt(video.comments_count)}</span>
                  </button>
                  <button onClick={e => { e.stopPropagation(); navigator.share?.({ title: video.title, url: window.location.href }) }} className="text-[#555] hover:text-white transition active:scale-90" aria-label="Share">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))
      )}

      {/* ── VIDEO MODAL ─────────────────────────────────────── */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-y-auto">
          <div className="w-full max-w-lg mx-auto min-h-screen bg-[#0f0f0f]">

            {/* PLAYER */}
            <div className="relative aspect-video bg-black">
              {selectedVideo.video_url
                ? <video src={selectedVideo.video_url} controls className="w-full h-full" autoPlay />
                : selectedVideo.thumbnail_url
                  ? <img src={selectedVideo.thumbnail_url} alt={selectedVideo.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] flex items-center justify-center">
                      <Play className="w-12 h-12 text-white/50" />
                    </div>
              }
              <button
                onClick={() => setSelectedVideo(null)}
                className="absolute top-3 left-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="px-4 pt-4 pb-8">
              {/* ACTIONS */}
              <div className="flex items-center gap-5 mb-4">
                <button onClick={() => handleLike(selectedVideo.id)} className="flex items-center gap-1.5 active:scale-90 transition">
                  <ThumbsUp
                    className="w-5 h-5"
                    fill={userLikes.has(selectedVideo.id) ? '#FF6B2B' : 'none'}
                    color={userLikes.has(selectedVideo.id) ? '#FF6B2B' : '#666'}
                    strokeWidth={1.5}
                  />
                  <span className={`text-sm font-semibold ${userLikes.has(selectedVideo.id) ? 'text-[#FF6B2B]' : 'text-[#666]'}`}>
                    {fmt(selectedVideo.likes_count)}
                  </span>
                </button>
                <button
                  onClick={() => { setSelectedVideo(null); openComments(selectedVideo.id) }}
                  className="text-[#666] hover:text-white transition"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigator.share?.({ title: selectedVideo.title, url: window.location.href })}
                  className="text-[#666] hover:text-white transition"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>

              {/* INSTRUCTOR */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
                    {selectedVideo.users?.avatar_url
                      ? <img src={selectedVideo.users.avatar_url} className="w-full h-full object-cover" />
                      : selectedVideo.users?.username?.[0]?.toUpperCase()
                    }
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold flex items-center gap-1.5">
                      {selectedVideo.users?.username}
                      {selectedVideo.users?.verified && <VerifiedBadge size={13} />}
                    </p>
                    {selectedVideo.users?.title && <p className="text-[#444] text-xs">{selectedVideo.users.title}</p>}
                  </div>
                </div>
                {user?.id !== selectedVideo.user_id && (
                  <button
                    onClick={() => handleFollow(selectedVideo.user_id)}
                    className={`text-sm font-bold px-4 py-1.5 rounded-full border transition ${
                      following.has(selectedVideo.user_id)
                        ? 'border-[rgba(255,255,255,0.12)] text-[#666]'
                        : 'border-white text-white hover:bg-white hover:text-black'
                    }`}
                  >
                    {following.has(selectedVideo.user_id) ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>

              <h2 className="text-white font-bold text-lg leading-snug mb-2">{selectedVideo.title}</h2>
              {selectedVideo.description && (
                <p className="text-[#555] text-sm leading-relaxed mb-2">{selectedVideo.description}</p>
              )}
              <p className="text-[#444] text-xs">{fmt(selectedVideo.views)} views · {selectedVideo.duration}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── COMMENTS SHEET ──────────────────────────────────── */}
      {commentVideoId && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCommentVideoId(null)} />
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-2xl flex flex-col"
            style={{ height: '72vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-[#333] rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.07)]">
              <h3 className="text-white font-bold">{comments.length} Comments</h3>
              <button onClick={() => setCommentVideoId(null)}>
                <X className="w-5 h-5 text-[#555]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {commentLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-[#333] border-t-white rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-center text-[#444] text-sm py-10">No comments yet. Be first!</p>
              ) : (
                comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                      {c.users?.avatar_url
                        ? <img src={c.users.avatar_url} className="w-full h-full object-cover" />
                        : c.users?.username?.[0]?.toUpperCase()
                      }
                    </div>
                    <div>
                      <p className="text-white text-xs font-bold mb-0.5 flex items-center gap-1.5">
                        {c.users?.username}
                        {c.users?.verified && <VerifiedBadge size={11} />}
                      </p>
                      <p className="text-[#888] text-sm">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {user ? (
              <form onSubmit={handleAddComment} className="px-4 py-3 border-t border-[rgba(255,255,255,0.07)] flex gap-2 items-center">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
                  {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : user.username?.[0]?.toUpperCase()}
                </div>
                <input
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Add a comment…"
                  className="flex-1 bg-[#252525] rounded-full px-4 py-2.5 text-white text-sm placeholder-[#555] outline-none"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="w-9 h-9 bg-white rounded-full flex items-center justify-center disabled:opacity-30 flex-shrink-0"
                >
                  <Send className="w-4 h-4 text-black" />
                </button>
              </form>
            ) : (
              <div className="px-4 py-4 text-center border-t border-[rgba(255,255,255,0.07)]">
                <p className="text-[#444] text-sm">Sign in to comment</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
