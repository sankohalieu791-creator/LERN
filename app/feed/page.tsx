'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Bell, ThumbsUp, MessageCircle, Share2, X, Send,
  Play, Trash2, Eye, Plus, Volume2, VolumeX,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getVideos, likeVideo, unlikeVideo, hasUserLiked,
  followUser, unfollowUser, isFollowing,
  getComments, addComment, deleteComment, getNotifications,
  createNotification, markNotificationsRead,
  incrementProfileViews,
} from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { sendPush } from '@/lib/push'
import CreatePost from '@/components/CreatePost'

function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center bg-[#1d9bf0] rounded-full flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ width: size * 0.58, height: size * 0.58 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return String(n)
}

export default function FeedPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [videos,         setVideos]         = useState<any[]>([])
  const [loading,        setLoading]        = useState(true)
  const [userLikes,      setUserLikes]      = useState<Set<string>>(new Set())
  const [likeAnim,       setLikeAnim]       = useState<Set<string>>(new Set())
  const [following,      setFollowing]      = useState<Set<string>>(new Set())
  const [muted,          setMuted]          = useState(true)
  const [commentsVideo,  setCommentsVideo]  = useState<any>(null)
  const [comments,       setComments]       = useState<any[]>([])
  const [newComment,     setNewComment]     = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [searchOpen,     setSearchOpen]     = useState(false)
  const [searchQuery,    setSearchQuery]    = useState('')
  const [notifCount,     setNotifCount]     = useState(0)
  const [notifs,         setNotifs]         = useState<any[]>([])
  const [showNotifs,     setShowNotifs]     = useState(false)
  const [showCreatePost, setShowCreatePost] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const videoEls     = useRef<Map<string, HTMLVideoElement>>(new Map())
  const searchRef    = useRef<HTMLInputElement>(null)
  const commentRef   = useRef<HTMLInputElement>(null)

  // Load data
  useEffect(() => {
    const load = async () => {
      const { data } = await getVideos()
      const vids = data || []
      setVideos(vids)
      if (user) {
        const [likes, follows, notifRes] = await Promise.all([
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
        const notifList = notifRes.data || []
        setNotifs(notifList)
        setNotifCount(notifList.filter((n: any) => !n.read).length)
      }
      setLoading(false)
    }
    load()
  }, [user])

  // IntersectionObserver — auto-play the visible video, pause others
  useEffect(() => {
    const container = containerRef.current
    if (!container || videoEls.current.size === 0) return
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const el = entry.target as HTMLVideoElement
          if (entry.isIntersecting) el.play().catch(() => {})
          else { el.pause(); el.currentTime = 0 }
        })
      },
      { root: container, threshold: 0.7 }
    )
    videoEls.current.forEach(v => observer.observe(v))
    return () => observer.disconnect()
  }, [videos, searchQuery])

  const goToProfile = async (userId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (user && user.id !== userId) {
      try { await incrementProfileViews(userId) } catch {}
    }
    router.push(`/profile/${userId}`)
  }

  const openComments = async (video: any) => {
    setCommentsVideo(video)
    setComments([])
    setNewComment('')
    setCommentLoading(true)
    try {
      await supabase.rpc('increment_video_views', { p_video_id: video.id })
      setVideos(vs => vs.map(v => v.id === video.id ? { ...v, views: v.views + 1 } : v))
    } catch {}
    const { data } = await getComments(video.id)
    setComments(data || [])
    setCommentLoading(false)
  }

  const handleLike = async (videoId: string) => {
    if (!user) return
    setLikeAnim(p => new Set([...p, videoId]))
    setTimeout(() => setLikeAnim(p => { const s = new Set(p); s.delete(videoId); return s }), 400)
    if (userLikes.has(videoId)) {
      await unlikeVideo(videoId, user.id)
      setUserLikes(p => { const s = new Set(p); s.delete(videoId); return s })
      setVideos(vs => vs.map(v => v.id === videoId ? { ...v, likes_count: Math.max(0, v.likes_count - 1) } : v))
      if (commentsVideo?.id === videoId) setCommentsVideo((v: any) => ({ ...v, likes_count: Math.max(0, v.likes_count - 1) }))
    } else {
      await likeVideo(videoId, user.id)
      setUserLikes(p => new Set([...p, videoId]))
      setVideos(vs => vs.map(v => v.id === videoId ? { ...v, likes_count: v.likes_count + 1 } : v))
      if (commentsVideo?.id === videoId) setCommentsVideo((v: any) => ({ ...v, likes_count: v.likes_count + 1 }))
      const vid = videos.find(v => v.id === videoId)
      if (vid && vid.user_id !== user.id) {
        sendPush(vid.user_id, '❤️ New like', `${(user as any).username} liked your video`, `/feed/${videoId}`)
        createNotification(vid.user_id, 'like', '❤️ New like', `${(user as any).username} liked your video`, `/feed/${videoId}`)
      }
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
      sendPush(userId, '👤 New follower', `${(user as any).username} started following you`, '/profile/me')
      createNotification(userId, 'follow', '👤 New follower', `${(user as any).username} started following you`, '/profile/me')
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newComment.trim() || !commentsVideo) return
    await addComment(commentsVideo.id, user.id, newComment.trim())
    setNewComment('')
    const { data } = await getComments(commentsVideo.id)
    setComments(data || [])
    setVideos(vs => vs.map(v => v.id === commentsVideo.id ? { ...v, comments_count: v.comments_count + 1 } : v))
    setCommentsVideo((v: any) => ({ ...v, comments_count: v.comments_count + 1 }))
    if (commentsVideo.user_id !== user.id) {
      sendPush(commentsVideo.user_id, '💬 New comment', `${(user as any).username}: ${newComment.trim().slice(0, 60)}`, `/feed/${commentsVideo.id}`)
      createNotification(commentsVideo.user_id, 'comment', '💬 New comment', `${(user as any).username}: ${newComment.trim().slice(0, 60)}`, `/feed/${commentsVideo.id}`)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return
    await deleteComment(commentId, user.id)
    setComments(prev => prev.filter(c => c.id !== commentId))
    if (commentsVideo) {
      setCommentsVideo((v: any) => ({ ...v, comments_count: Math.max(0, v.comments_count - 1) }))
      setVideos(vs => vs.map(v => v.id === commentsVideo.id ? { ...v, comments_count: Math.max(0, v.comments_count - 1) } : v))
    }
  }

  const filteredVideos = searchQuery.trim()
    ? videos.filter(v =>
        v.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.users?.username?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : videos

  if (loading) return (
    <div className="fixed inset-0 bg-black flex items-center justify-center" style={{ zIndex: 10 }}>
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  )

  return (
    <>
    {/* ── Full-screen snap-scroll container ── */}
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black"
      style={{
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      } as React.CSSProperties}
    >
      {filteredVideos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center px-8 text-center"
          style={{ height: '100vh', scrollSnapAlign: 'start' }}
        >
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
            <Play className="w-7 h-7 text-white/40 ml-0.5" />
          </div>
          <p className="text-white font-bold text-lg mb-2">
            {searchQuery ? 'No results' : 'No posts yet'}
          </p>
          <p className="text-white/40 text-sm">
            {searchQuery ? 'Try a different search' : 'Be the first to post a video'}
          </p>
        </div>
      ) : (
        filteredVideos.map(video => (
          <div
            key={video.id}
            className="relative bg-black overflow-hidden"
            style={{ height: '100vh', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
          >
            {/* Video / thumbnail */}
            {video.video_url ? (
              <video
                ref={el => { if (el) videoEls.current.set(video.id, el); else videoEls.current.delete(video.id) }}
                src={video.video_url}
                loop
                playsInline
                muted={muted}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : video.thumbnail_url ? (
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] flex items-center justify-center">
                <Play className="w-20 h-20 text-white/20" />
              </div>
            )}

            {/* Gradient overlay — dark top + dark bottom */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 22%, transparent 48%, rgba(0,0,0,0.72) 75%, rgba(0,0,0,0.92) 100%)',
              }}
            />

            {/* ── Bottom info ── */}
            <div
              className="absolute left-0 right-0 px-4"
              style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + 72px)` }}
            >
              {/* Actions */}
              <div className="flex items-center gap-6 mb-4">
                <button
                  onClick={() => handleLike(video.id)}
                  className="flex items-center gap-2 active:scale-90 transition-transform"
                >
                  <span className={likeAnim.has(video.id) ? 'like-spin' : ''} style={{ display: 'inline-flex' }}>
                    <ThumbsUp
                      className={`w-6 h-6 transition-transform duration-300 ${userLikes.has(video.id) ? 'rotate-0' : 'rotate-180'}`}
                      fill={userLikes.has(video.id) ? '#ef4444' : 'none'}
                      color={userLikes.has(video.id) ? '#ef4444' : 'rgba(255,255,255,0.9)'}
                      strokeWidth={1.5}
                    />
                  </span>
                  <span className={`text-sm font-bold ${userLikes.has(video.id) ? 'text-red-400' : 'text-white/90'}`}>
                    {fmt(video.likes_count)}
                  </span>
                </button>

                <button
                  onClick={() => openComments(video)}
                  className="flex items-center gap-2 active:scale-90 transition-transform"
                >
                  <MessageCircle className="w-6 h-6 text-white/90" strokeWidth={1.5} />
                  <span className="text-white/90 text-sm font-bold">{fmt((video as any).comments_count || 0)}</span>
                </button>

                <button
                  onClick={() => navigator.share?.({ title: video.title, url: `${window.location.origin}/feed/${video.id}` })}
                  className="active:scale-90 transition-transform"
                >
                  <Share2 className="w-6 h-6 text-white/90" strokeWidth={1.5} />
                </button>
              </div>

              {/* Instructor row */}
              <div className="flex items-center justify-between mb-2.5">
                <button
                  onClick={e => goToProfile(video.user_id, e)}
                  className="flex items-center gap-2.5 flex-1 min-w-0 mr-3"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0 border-2 border-white/20">
                    {video.users?.avatar_url
                      ? <img src={video.users.avatar_url} className="w-full h-full object-cover" />
                      : video.users?.username?.[0]?.toUpperCase()
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold flex items-center gap-1.5 leading-none">
                      {video.users?.username}
                      {video.users?.verified && <VerifiedBadge size={13} />}
                    </p>
                    {video.users?.title && (
                      <p className="text-white/50 text-xs truncate mt-0.5">{video.users.title}</p>
                    )}
                  </div>
                </button>
                {user?.id !== video.user_id && (
                  <button
                    onClick={e => handleFollow(video.user_id, e)}
                    className={`flex-shrink-0 text-[13px] font-bold px-4 py-1.5 rounded-full border transition-all ${
                      following.has(video.user_id)
                        ? 'border-white/20 text-white/40'
                        : 'border-white text-white'
                    }`}
                  >
                    {following.has(video.user_id) ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>

              {/* Title */}
              <h3 className="text-white font-bold text-[15px] leading-snug mb-1.5 line-clamp-2">
                {video.title}
              </h3>

              {/* Description */}
              {video.description && (
                <p className="text-white/60 text-[13px] leading-snug line-clamp-2 mb-1.5">
                  {video.description}
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <Eye className="w-3 h-3" />
                <span>{fmt(video.views)} views</span>
                {video.duration && <><span>·</span><span>{video.duration}</span></>}
              </div>
            </div>
          </div>
        ))
      )}
    </div>

    {/* ── Fixed top overlay (search / notifs / create) ── */}
    <div
      className="fixed left-0 right-0 flex items-center justify-between px-4 z-[200]"
      style={{
        top: 'env(safe-area-inset-top, 0px)',
        paddingTop: 12,
        paddingBottom: 8,
        background: searchOpen ? 'rgba(0,0,0,0.92)' : 'transparent',
        transition: 'background 0.2s ease',
      }}
    >
      {searchOpen ? (
        <div className="flex-1 flex items-center gap-3">
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search videos…"
            autoFocus
            className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2.5 text-white text-sm placeholder-white/30 outline-none"
          />
          <button
            onClick={() => { setSearchOpen(false); setSearchQuery('') }}
            className="text-white/70 text-sm font-semibold flex-shrink-0"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => setShowCreatePost(true)}
            className="flex items-center gap-1.5 bg-white text-black text-sm font-bold px-4 py-1.5 rounded-full active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Create
          </button>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMuted(m => !m)}
              className="w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform border border-white/10"
            >
              {muted
                ? <VolumeX className="w-4 h-4 text-white" />
                : <Volume2 className="w-4 h-4 text-white" />
              }
            </button>
            <button
              onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50) }}
              className="w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform border border-white/10"
            >
              <Search className="w-4 h-4 text-white" />
            </button>
            <button
              className="relative w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform border border-white/10"
              onClick={async () => {
                setShowNotifs(true)
                if (notifCount > 0 && user) {
                  await markNotificationsRead(user.id)
                  setNotifCount(0)
                  setNotifs(prev => prev.map(n => ({ ...n, read: true })))
                }
              }}
            >
              <Bell className="w-4 h-4 text-white" />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
          </div>
        </>
      )}
    </div>

    {/* ── Notifications panel ── */}
    {showNotifs && (
      <div className="fixed inset-0 flex flex-col" style={{ zIndex: 10001 }}>
        <div className="absolute inset-0 bg-black/60" onClick={() => setShowNotifs(false)} />
        <div
          className="relative mt-auto bg-[#141414] rounded-t-3xl flex flex-col"
          style={{ maxHeight: '75vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex justify-center pt-3 flex-shrink-0">
            <div className="w-10 h-1 bg-[#333] rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 pt-3 pb-3 flex-shrink-0 border-b border-[rgba(255,255,255,0.07)]">
            <h2 className="text-white font-bold text-lg">Notifications</h2>
            <button onClick={() => setShowNotifs(false)} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-8">
                <Bell className="w-10 h-10 text-[#2a2a2a] mb-3" />
                <p className="text-[#444] text-sm text-center">No notifications yet</p>
                <p className="text-[#333] text-xs text-center mt-1">Likes, comments and follows will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                {notifs.map((n: any) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-5 py-4 cursor-pointer active:bg-[#1e1e1e] ${!n.read ? 'bg-[rgba(255,107,43,0.05)]' : ''}`}
                    onClick={() => { setShowNotifs(false); if (n.link) window.location.href = n.link }}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-base flex-shrink-0">
                      {n.type === 'like' ? '❤️' : n.type === 'comment' ? '💬' : n.type === 'follow' ? '👤' : '🔔'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold">{n.title}</p>
                      <p className="text-[#888] text-xs mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[#444] text-xs mt-1">
                        {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    {!n.read && <div className="w-2 h-2 bg-[#FF6B2B] rounded-full flex-shrink-0 mt-1.5" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* ── Comments bottom sheet ── */}
    {commentsVideo && (
      <div className="fixed inset-0 flex flex-col justify-end" style={{ zIndex: 10001 }}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setCommentsVideo(null)} />
        <div
          className="relative bg-[#1a1a1a] rounded-t-3xl flex flex-col"
          style={{ maxHeight: '75vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex justify-center pt-3 flex-shrink-0">
            <div className="w-10 h-1 bg-[#333] rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 pt-3 pb-3 flex-shrink-0 border-b border-[rgba(255,255,255,0.07)]">
            <h2 className="text-white font-bold text-base">{comments.length} Comments</h2>
            <button onClick={() => setCommentsVideo(null)} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3">
            {commentLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#333] border-t-white rounded-full animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-[#444] text-sm text-center py-8">No comments yet — be the first!</p>
            ) : (
              <div className="space-y-4">
                {comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                      {c.users?.avatar_url
                        ? <img src={c.users.avatar_url} className="w-full h-full object-cover" />
                        : c.users?.username?.[0]?.toUpperCase()
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-bold mb-0.5 flex items-center gap-1">
                        {c.users?.username}
                        {c.users?.verified && <VerifiedBadge size={11} />}
                      </p>
                      <p className="text-[#888] text-sm leading-relaxed">{c.text}</p>
                    </div>
                    {user?.id === c.user_id && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="flex-shrink-0 text-[#444] active:text-red-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {user ? (
            <form
              onSubmit={handleAddComment}
              className="flex-shrink-0 px-4 py-3 border-t border-[rgba(255,255,255,0.07)] flex gap-3 items-center"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
                {(user as any).avatar_url
                  ? <img src={(user as any).avatar_url} className="w-full h-full object-cover" />
                  : (user as any).username?.[0]?.toUpperCase()
                }
              </div>
              <input
                ref={commentRef}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 bg-[#111] border border-white/10 rounded-full px-4 py-3 text-white text-sm placeholder-[#444] outline-none focus:border-white/25 transition"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center disabled:opacity-30 flex-shrink-0 active:scale-95 transition"
              >
                <Send className="w-4 h-4 text-black" />
              </button>
            </form>
          ) : (
            <div className="flex-shrink-0 px-4 py-4 text-center border-t border-white/10">
              <p className="text-[#444] text-sm">Sign in to comment</p>
            </div>
          )}
        </div>
      </div>
    )}

    <CreatePost isOpen={showCreatePost} onClose={() => setShowCreatePost(false)} />
    </>
  )
}
