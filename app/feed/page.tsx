'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, ThumbsUp, MessageCircle, Share2, X, Send, Play, Trash2, Eye, Clock } from 'lucide-react'
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

function timeAgo(dateStr: string) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K'
  return String(n)
}

// Auto-plays video preview after 3 s of visible dwell — like YouTube
function FeedCard({ video, userLikes, likeAnim, following, user, onOpen, onLike, onFollow, onProfile }: {
  video: any
  userLikes: Set<string>
  likeAnim: Set<string>
  following: Set<string>
  user: any
  onOpen: () => void
  onLike: (e: React.MouseEvent) => void
  onFollow: (e: React.MouseEvent) => void
  onProfile: () => void
}) {
  const [playing, setPlaying] = useState(false)
  const cardRef  = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = cardRef.current
    if (!el || !video.video_url) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timerRef.current = setTimeout(() => setPlaying(true), 3000)
        } else {
          if (timerRef.current) clearTimeout(timerRef.current)
          setPlaying(false)
        }
      },
      { threshold: 0.6 }
    )
    obs.observe(el)
    return () => { obs.disconnect(); if (timerRef.current) clearTimeout(timerRef.current) }
  }, [video.video_url])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (playing) v.play().catch(() => {})
    else { v.pause(); v.currentTime = 0 }
  }, [playing])

  return (
    <article ref={cardRef} onClick={onOpen} className="cursor-pointer border-b border-[rgba(255,255,255,0.05)]">
      <div className="relative w-full bg-[#1a1a1a] overflow-hidden" style={{ height: '230px' }}>
        {/* Thumbnail */}
        {video.thumbnail_url
          ? <img src={video.thumbnail_url} alt={video.title}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${playing ? 'opacity-0' : 'opacity-100'}`} />
          : <div className={`absolute inset-0 bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] transition-opacity ${playing ? 'opacity-0' : 'opacity-100'}`} />
        }

        {/* Video preview */}
        {video.video_url && (
          <video ref={videoRef} src={video.video_url} muted loop playsInline
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${playing ? 'opacity-100' : 'opacity-0'}`}
          />
        )}

        {video.subject && (
          <span className="absolute top-2.5 left-2.5 text-[10px] font-bold bg-black/70 text-white px-2.5 py-1 rounded-full uppercase tracking-wide">
            {video.subject}
          </span>
        )}
        {video.duration && (
          <span className="absolute top-2.5 right-2.5 bg-black/70 text-white text-[11px] px-2 py-1 rounded-full font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3" />{video.duration}
          </span>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pt-8 pb-3">
          <h3 className="text-white font-bold text-[15px] leading-snug line-clamp-2">{video.title}</h3>
        </div>
      </div>

      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-2">
          <button onClick={e => { e.stopPropagation(); onProfile() }} className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-[11px] font-bold overflow-hidden flex-shrink-0">
              {video.users?.avatar_url
                ? <img src={video.users.avatar_url} className="w-full h-full object-cover" />
                : video.users?.username?.[0]?.toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold flex items-center gap-1 leading-none mb-0.5">
                {video.users?.username}
                {video.users?.verified && (
                  <span className="inline-flex items-center justify-center bg-[#1d9bf0] rounded-full flex-shrink-0" style={{ width: 13, height: 13 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 7.5, height: 7.5 }}><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                )}
              </p>
              {video.users?.title && <p className="text-[#555] text-xs truncate">{video.users.title}</p>}
            </div>
          </button>
          {user?.id !== video.user_id && (
            <button onClick={onFollow}
              className={`flex-shrink-0 text-[12px] font-bold px-4 py-1.5 rounded-full border transition ${
                following.has(video.user_id) ? 'border-[rgba(255,255,255,0.1)] text-[#444]' : 'border-white text-white'
              }`}>
              {following.has(video.user_id) ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {video.description && (
          <p className="text-[#555] text-sm line-clamp-2 mb-2 leading-snug">{video.description}</p>
        )}

        <div className="flex items-center gap-3 text-[#444] text-xs mb-3">
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{fmt(video.views)} views</span>
          {video.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{video.duration}</span>}
          <span>{timeAgo(video.created_at)}</span>
        </div>

        <div className="flex items-center gap-5 pb-4">
          <button onClick={onLike} className="flex items-center gap-1.5 active:scale-90 transition-transform">
            <span className={likeAnim.has(video.id) ? 'like-spin' : ''} style={{ display: 'inline-flex' }}>
              <ThumbsUp
                className={`w-5 h-5 transition-transform duration-300 ${userLikes.has(video.id) ? 'rotate-0' : 'rotate-180'}`}
                fill={userLikes.has(video.id) ? '#ef4444' : 'none'}
                color={userLikes.has(video.id) ? '#ef4444' : '#555'}
                strokeWidth={1.5}
              />
            </span>
            <span className={`text-sm font-semibold ${userLikes.has(video.id) ? 'text-red-500' : 'text-[#555]'}`}>
              {fmt(video.likes_count)}
            </span>
          </button>
          <button onClick={e => { e.stopPropagation(); onOpen() }} className="flex items-center gap-1.5 text-[#555] active:scale-90 transition-transform">
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-semibold">{fmt((video as any).comments_count || 0)}</span>
          </button>
          <button
            onClick={e => { e.stopPropagation(); navigator.share?.({ title: video.title, url: `${window.location.origin}/feed/${video.id}` }) }}
            className="text-[#555] active:scale-90 transition-transform ml-auto"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </article>
  )
}

export default function FeedPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [videos,         setVideos]         = useState<any[]>([])
  const [loading,        setLoading]        = useState(true)
  const [userLikes,      setUserLikes]      = useState<Set<string>>(new Set())
  const [likeAnim,       setLikeAnim]       = useState<Set<string>>(new Set())
  const [following,      setFollowing]      = useState<Set<string>>(new Set())
  const [selectedVideo,  setSelectedVideo]  = useState<any>(null)
  const [searchOpen,     setSearchOpen]     = useState(false)
  const [searchQuery,    setSearchQuery]    = useState('')
  const [notifCount,     setNotifCount]     = useState(0)
  const [notifs,         setNotifs]         = useState<any[]>([])
  const [showNotifs,     setShowNotifs]     = useState(false)
  const [comments,       setComments]       = useState<any[]>([])
  const [newComment,     setNewComment]     = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const searchRef  = useRef<HTMLInputElement>(null)
  const commentRef = useRef<HTMLInputElement>(null)

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

  const goToProfile = async (userId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (user && user.id !== userId) {
      try { await incrementProfileViews(userId) } catch {}
    }
    router.push(`/profile/${userId}`)
  }

  const openVideo = async (video: any) => {
    setSelectedVideo(video)
    setComments([])
    setNewComment('')
    try {
      await supabase.rpc('increment_video_views', { p_video_id: video.id })
      setVideos(vs => vs.map(v => v.id === video.id ? { ...v, views: v.views + 1 } : v))
    } catch {}
    setCommentLoading(true)
    const { data } = await getComments(video.id)
    setComments(data || [])
    setCommentLoading(false)
  }

  const handleLike = async (videoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!user) return
    setLikeAnim(p => new Set([...p, videoId]))
    setTimeout(() => setLikeAnim(p => { const s = new Set(p); s.delete(videoId); return s }), 400)
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
      const vid = videos.find(v => v.id === videoId)
      if (vid && vid.user_id !== user.id) {
        sendPush(vid.user_id, '❤️ New like', `${(user as any).username} liked your video`, `/feed/${videoId}`)
        createNotification(vid.user_id, 'like', '❤️ New like', `${(user as any).username} liked your video`, `/feed/${videoId}`, { id: user.id, username: (user as any).username, avatar_url: (user as any).avatar_url })
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
      createNotification(userId, 'follow', '👤 New follower', `${(user as any).username} started following you`, '/profile/me', { id: user.id, username: (user as any).username, avatar_url: (user as any).avatar_url })
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newComment.trim() || !selectedVideo) return
    await addComment(selectedVideo.id, user.id, newComment.trim())
    setNewComment('')
    const { data } = await getComments(selectedVideo.id)
    setComments(data || [])
    setVideos(vs => vs.map(v => v.id === selectedVideo.id ? { ...v, comments_count: v.comments_count + 1 } : v))
    setSelectedVideo((v: any) => ({ ...v, comments_count: v.comments_count + 1 }))
    if (selectedVideo.user_id !== user.id) {
      sendPush(selectedVideo.user_id, '💬 New comment', `${(user as any).username}: ${newComment.trim().slice(0, 60)}`, `/feed/${selectedVideo.id}`)
      createNotification(selectedVideo.user_id, 'comment', '💬 New comment', `${(user as any).username}: ${newComment.trim().slice(0, 60)}`, `/feed/${selectedVideo.id}`, { id: user.id, username: (user as any).username, avatar_url: (user as any).avatar_url })
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return
    await deleteComment(commentId, user.id)
    setComments(prev => prev.filter(c => c.id !== commentId))
    if (selectedVideo) {
      setSelectedVideo((v: any) => ({ ...v, comments_count: Math.max(0, v.comments_count - 1) }))
      setVideos(vs => vs.map(v => v.id === selectedVideo.id ? { ...v, comments_count: Math.max(0, v.comments_count - 1) } : v))
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
    <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center z-10">
      <div className="w-8 h-8 border-2 border-[#333] border-t-white rounded-full animate-spin" />
    </div>
  )

  return (
    <>
    <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col z-10">

      {/* HEADER */}
      <div
        className="flex-shrink-0 bg-[#0f0f0f] border-b border-[rgba(255,255,255,0.06)]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {searchOpen ? (
          <div className="px-4 py-3 flex items-center gap-3">
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search videos…"
              autoFocus
              className="flex-1 bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-full px-4 py-2.5 text-white text-sm placeholder-[#444] outline-none"
            />
            <button onClick={() => { setSearchOpen(false); setSearchQuery('') }}
              className="text-[#888] text-sm font-semibold">Cancel</button>
          </div>
        ) : (
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-white font-black text-xl tracking-tight">LERN</span>
            <div className="flex items-center gap-5">
              <button onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50) }}>
                <Search className="w-6 h-6 text-[#888]" />
              </button>
              <button
                className="relative"
                onClick={async () => {
                  setShowNotifs(true)
                  if (notifCount > 0 && user) {
                    await markNotificationsRead(user.id)
                    setNotifCount(0)
                    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
                  }
                }}
              >
                <Bell className="w-6 h-6 text-[#888]" />
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

      {/* FEED */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}
      >
        {filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
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
            <FeedCard
              key={video.id}
              video={video}
              userLikes={userLikes}
              likeAnim={likeAnim}
              following={following}
              user={user}
              onOpen={() => openVideo(video)}
              onLike={e => handleLike(video.id, e)}
              onFollow={e => handleFollow(video.user_id, e)}
              onProfile={() => goToProfile(video.user_id)}
            />
          ))
        )}
      </div>
    </div>

    {/* NOTIFICATIONS PANEL */}
    {showNotifs && (
      <div className="fixed inset-0 z-[60] flex flex-col">
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
                    className={`flex items-start gap-3 px-5 py-4 ${!n.read ? 'bg-[rgba(255,107,43,0.05)]' : ''}`}
                  >
                    {/* Sender avatar — tap to view their profile */}
                    <button
                      onClick={() => {
                        setShowNotifs(false)
                        if (n.sender_id) router.push(`/profile/${n.sender_id}`)
                      }}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden"
                    >
                      {n.sender_avatar_url
                        ? <img src={n.sender_avatar_url} className="w-full h-full object-cover" />
                        : n.sender_username?.[0]?.toUpperCase()
                          ?? (n.type === 'like' ? '❤️' : n.type === 'comment' ? '💬' : n.type === 'follow' ? '👤' : '🔔')
                      }
                    </button>
                    {/* Content — tap to go to the post/video */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer active:opacity-80"
                      onClick={() => { setShowNotifs(false); if (n.link) window.location.href = n.link }}
                    >
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

    {/* VIDEO MODAL */}
    {selectedVideo && (
      <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 10000 }}>

        <div className="flex-shrink-0 bg-black" style={{ height: 'env(safe-area-inset-top)' }} />

        {/* VIDEO */}
        <div className="relative w-full flex-shrink-0 bg-black" style={{ height: '40vh' }}>
          {selectedVideo.video_url
            ? <video
                src={selectedVideo.video_url}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain bg-black"
              />
            : selectedVideo.thumbnail_url
              ? <img src={selectedVideo.thumbnail_url} alt={selectedVideo.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                    <Play className="w-8 h-8 text-white/50 ml-1" />
                  </div>
                </div>
          }
          <button
            onClick={() => setSelectedVideo(null)}
            className="absolute top-3 right-3 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center z-10"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto bg-[#0f0f0f]">
          <div className="px-4 pt-4 pb-2">

            {/* ACTION ROW */}
            <div className="flex items-center gap-6 pb-4 border-b border-[rgba(255,255,255,0.07)] mb-4">
              <button onClick={() => handleLike(selectedVideo.id)} className="flex items-center gap-2 active:scale-90 transition-transform">
                <span className={likeAnim.has(selectedVideo.id) ? 'like-spin' : ''} style={{ display: 'inline-flex' }}>
                  <ThumbsUp
                    className={`w-6 h-6 transition-transform duration-300 ${userLikes.has(selectedVideo.id) ? 'rotate-0' : 'rotate-180'}`}
                    fill={userLikes.has(selectedVideo.id) ? '#ef4444' : 'none'}
                    color={userLikes.has(selectedVideo.id) ? '#ef4444' : '#888'}
                    strokeWidth={1.5}
                  />
                </span>
                <span className={`text-sm font-bold ${userLikes.has(selectedVideo.id) ? 'text-red-500' : 'text-[#888]'}`}>
                  {fmt(selectedVideo.likes_count)}
                </span>
              </button>
              <button
                onClick={() => setTimeout(() => commentRef.current?.focus(), 100)}
                className="flex items-center gap-2 text-[#888] active:scale-90 transition-transform"
              >
                <MessageCircle className="w-6 h-6" />
                <span className="text-sm font-bold">{fmt((selectedVideo as any).comments_count || 0)}</span>
              </button>
              <button
                onClick={() => navigator.share?.({ title: selectedVideo.title, url: `${window.location.origin}/feed/${selectedVideo.id}` })}
                className="text-[#888] active:scale-90 transition-transform ml-auto"
              >
                <Share2 className="w-6 h-6" />
              </button>
            </div>

            {/* INSTRUCTOR ROW */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => { setSelectedVideo(null); goToProfile(selectedVideo.user_id) }}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
                  {selectedVideo.users?.avatar_url
                    ? <img src={selectedVideo.users.avatar_url} className="w-full h-full object-cover" />
                    : selectedVideo.users?.username?.[0]?.toUpperCase()
                  }
                </div>
                <div className="text-left min-w-0">
                  <p className="text-white text-sm font-bold flex items-center gap-1.5">
                    {selectedVideo.users?.username}
                    {selectedVideo.users?.verified && <VerifiedBadge size={13} />}
                  </p>
                  {(selectedVideo.users as any)?.title && (
                    <p className="text-[#555] text-xs truncate">{(selectedVideo.users as any).title}</p>
                  )}
                </div>
              </button>
              {user?.id !== selectedVideo.user_id && (
                <button
                  onClick={() => handleFollow(selectedVideo.user_id)}
                  className={`flex-shrink-0 text-sm font-bold px-5 py-2 rounded-full border transition ${
                    following.has(selectedVideo.user_id)
                      ? 'border-[rgba(255,255,255,0.12)] text-[#666]'
                      : 'border-white text-white'
                  }`}
                >
                  {following.has(selectedVideo.user_id) ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* TITLE */}
            <h2 className="text-white font-bold text-base leading-snug mb-2">{selectedVideo.title}</h2>

            {/* DESCRIPTION */}
            {selectedVideo.description && (
              <p className="text-[#555] text-sm leading-relaxed mb-3">{selectedVideo.description}</p>
            )}

            {/* STATS */}
            <div className="flex items-center gap-3 text-[#444] text-xs mb-5">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{fmt(selectedVideo.views)} views</span>
              {selectedVideo.duration && <span>· {selectedVideo.duration}</span>}
            </div>

            {/* COMMENTS */}
            <div className="border-t border-[rgba(255,255,255,0.07)] pt-4">
              <p className="text-white font-bold mb-4">{comments.length} Comments</p>
              {commentLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#333] border-t-white rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-[#444] text-sm text-center py-6">No comments yet — be the first!</p>
              ) : (
                <div className="space-y-4 pb-2">
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
                        <p className="text-[#888] text-sm">{c.text}</p>
                      </div>
                      {user?.id === c.user_id && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="flex-shrink-0 text-[#444] hover:text-red-400 transition p-1 active:scale-90"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="h-4" />
        </div>

        {/* COMMENT INPUT */}
        {user ? (
          <form
            onSubmit={handleAddComment}
            className="flex-shrink-0 px-4 py-3 border-t border-[rgba(255,255,255,0.08)] bg-[#111] flex gap-3 items-center"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
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
              className="flex-1 bg-[#1e1e1e] border border-[rgba(255,255,255,0.1)] rounded-full px-4 py-3 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.25)] transition"
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
          <div
            className="flex-shrink-0 px-4 py-4 text-center border-t border-[rgba(255,255,255,0.08)] bg-[#111]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
          >
            <p className="text-[#444] text-sm">Sign in to comment</p>
          </div>
        )}
      </div>
    )}

    </>
  )
}
