'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Bell, ThumbsUp, ThumbsDown, MessageCircle, Share2, X, Send, Play } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getVideos, likeVideo, unlikeVideo, hasUserLiked,
  followUser, unfollowUser, isFollowing,
  getComments, addComment, getNotifications,
  createNotification, markNotificationsRead,
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
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
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

export default function FeedPage() {
  const { user } = useAuth()

  const [videos,        setVideos]        = useState<any[]>([])
  const [loading,       setLoading]       = useState(true)
  const [userLikes,     setUserLikes]     = useState<Set<string>>(new Set())
  const [likeAnim,      setLikeAnim]      = useState<Set<string>>(new Set())
  const [following,     setFollowing]     = useState<Set<string>>(new Set())
  const [selectedVideo, setSelectedVideo] = useState<any>(null)
  const [searchOpen,    setSearchOpen]    = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [notifCount,    setNotifCount]    = useState(0)
  const [notifs,        setNotifs]        = useState<any[]>([])
  const [showNotifs,    setShowNotifs]    = useState(false)
  const [comments,      setComments]      = useState<any[]>([])
  const [newComment,    setNewComment]    = useState('')
  const [commentLoading,setCommentLoading]= useState(false)

  const searchRef  = useRef<HTMLInputElement>(null)
  const commentRef = useRef<HTMLInputElement>(null)

  // Lock both <html> and <body> scroll. Also set overscroll-behavior so iOS
  // PWA can't rubber-band even when overflow is technically 0.
  useEffect(() => {
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    const prevBodyOs = (document.body.style as any).overscrollBehavior
    const prevHtmlOs = (document.documentElement.style as any).overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    ;(document.body.style as any).overscrollBehavior = 'none'
    ;(document.documentElement.style as any).overscrollBehavior = 'none'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
      ;(document.body.style as any).overscrollBehavior = prevBodyOs
      ;(document.documentElement.style as any).overscrollBehavior = prevHtmlOs
    }
  }, [])

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
        const notifList = notifs.data || []
        setNotifs(notifList)
        setNotifCount(notifList.filter((n: any) => !n.read).length)
      }
      setLoading(false)
    }
    load()
  }, [user])

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
    if (!user || !newComment.trim() || !selectedVideo) return
    await addComment(selectedVideo.id, user.id, newComment.trim())
    setNewComment('')
    const { data } = await getComments(selectedVideo.id)
    setComments(data || [])
    setVideos(vs => vs.map(v => v.id === selectedVideo.id ? { ...v, comments_count: v.comments_count + 1 } : v))
    setSelectedVideo((v: any) => ({ ...v, comments_count: v.comments_count + 1 }))
    if (selectedVideo.user_id !== user.id) {
      sendPush(selectedVideo.user_id, '💬 New comment', `${(user as any).username}: ${newComment.trim().slice(0, 60)}`, `/feed/${selectedVideo.id}`)
      createNotification(selectedVideo.user_id, 'comment', '💬 New comment', `${(user as any).username}: ${newComment.trim().slice(0, 60)}`, `/feed/${selectedVideo.id}`)
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

      {/* ── HEADER — never moves ────────────────────────────── */}
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
              className="text-[#888] text-sm font-semibold">
              Cancel
            </button>
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

      {/* ── VIDEO CARDS — only this scrolls ─────────────────── */}
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
            <article
              key={video.id}
              onClick={() => openVideo(video)}
              className="cursor-pointer border-b border-[rgba(255,255,255,0.05)]"
            >
              {/* THUMBNAIL — compact height */}
              <div className="relative w-full bg-[#1a1a1a] overflow-hidden" style={{ height: '180px' }}>
                {video.thumbnail_url
                  ? <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                        <Play className="w-6 h-6 text-white/50 ml-0.5" />
                      </div>
                    </div>
                }
                <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded ${SUBJECT_STYLES[video.subject] ?? 'bg-[#252525] text-[#888]'}`}>
                  {video.subject}
                </span>
                <span className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                  {video.duration}
                </span>
              </div>

              {/* CARD BODY */}
              <div className="px-4 pt-2.5 pb-3">
                <h3 className="text-white font-bold text-sm leading-snug mb-2 line-clamp-2">{video.title}</h3>

                {/* INSTRUCTOR + FOLLOW + ACTIONS in one row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden">
                      {video.users?.avatar_url
                        ? <img src={video.users.avatar_url} className="w-full h-full object-cover" />
                        : video.users?.username?.[0]?.toUpperCase()
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#888] text-xs font-semibold flex items-center gap-1 truncate">
                        {video.users?.username}
                        {video.users?.verified && <VerifiedBadge size={11} />}
                        {video.users?.title && <span className="text-[#555]">· {video.users.title}</span>}
                      </p>
                      <p className="text-[#444] text-[11px]">{fmt(video.views)} views · {timeAgo(video.created_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 ml-2">
                    {user?.id !== video.user_id && (
                      <button
                        onClick={e => handleFollow(video.user_id, e)}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition ${
                          following.has(video.user_id)
                            ? 'border-[rgba(255,255,255,0.1)] text-[#444]'
                            : 'border-white text-white'
                        }`}
                      >
                        {following.has(video.user_id) ? 'Following' : 'Follow'}
                      </button>
                    )}

                    <button onClick={e => handleLike(video.id, e)} className="flex items-center gap-1 active:scale-90 transition-transform">
                      <span className={likeAnim.has(video.id) ? 'like-spin' : ''} style={{ display: 'inline-flex' }}>
                        {userLikes.has(video.id)
                          ? <ThumbsUp  className="w-5 h-5" fill="#ef4444" color="#ef4444" strokeWidth={1.5} />
                          : <ThumbsDown className="w-5 h-5" fill="none"    color="#555"    strokeWidth={1.5} />
                        }
                      </span>
                      <span className={`text-xs font-bold ${userLikes.has(video.id) ? 'text-red-500' : 'text-[#555]'}`}>
                        {fmt(video.likes_count)}
                      </span>
                    </button>

                    <button
                      onClick={e => { e.stopPropagation(); openVideo(video) }}
                      className="flex items-center gap-1 text-[#555] active:scale-90 transition-transform"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span className="text-xs font-bold">{fmt(video.comments_count)}</span>
                    </button>

                    <button
                      onClick={e => { e.stopPropagation(); navigator.share?.({ title: video.title, url: `${window.location.origin}/feed/${video.id}` }) }}
                      className="text-[#555] active:scale-90 transition-transform"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>

    {/* ── NOTIFICATIONS PANEL ────────────────────────────── */}
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
                      className={`flex items-start gap-3 px-5 py-4 cursor-pointer active:bg-[#1e1e1e] transition ${!n.read ? 'bg-[rgba(255,107,43,0.05)]' : ''}`}
                      onClick={() => {
                        setShowNotifs(false)
                        if (n.link) window.location.href = n.link
                      }}
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

      {/* ── VIDEO MODAL ─────────────────────────────────────── */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col">

          {/* VIDEO — sits just below status bar */}
          <div
            className="relative w-full aspect-video bg-black flex-shrink-0"
            style={{ marginTop: 'env(safe-area-inset-top)' }}
          >
            {selectedVideo.video_url
              ? <video
                  src={selectedVideo.video_url}
                  controls
                  autoPlay
                  playsInline
                  // @ts-ignore
                  webkit-playsinline="true"
                  className="w-full h-full"
                />
              : selectedVideo.thumbnail_url
                ? <img src={selectedVideo.thumbnail_url} alt={selectedVideo.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] flex items-center justify-center">
                    <Play className="w-12 h-12 text-white/50" />
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
            <div className="px-4 pt-5 pb-4">

              {/* ACTIONS ROW */}
              <div className="flex items-center gap-7 mb-5">
                <button onClick={() => handleLike(selectedVideo.id)} className="flex items-center gap-2.5 active:scale-90 transition-transform">
                  <span className={likeAnim.has(selectedVideo.id) ? 'like-spin' : ''} style={{ display: 'inline-flex' }}>
                    {userLikes.has(selectedVideo.id)
                      ? <ThumbsUp  className="w-8 h-8" fill="#ef4444" color="#ef4444" strokeWidth={1.5} />
                      : <ThumbsDown className="w-8 h-8" fill="none"    color="#888"    strokeWidth={1.5} />
                    }
                  </span>
                  <span className={`text-base font-bold ${userLikes.has(selectedVideo.id) ? 'text-red-500' : 'text-[#888]'}`}>
                    {fmt(selectedVideo.likes_count)}
                  </span>
                </button>

                <button
                  onClick={() => setTimeout(() => commentRef.current?.focus(), 100)}
                  className="flex items-center gap-2.5 text-[#888] active:scale-90 transition-transform"
                >
                  <MessageCircle className="w-8 h-8" />
                  <span className="text-base font-bold">{fmt(selectedVideo.comments_count)}</span>
                </button>

                <button
                  onClick={() => navigator.share?.({ title: selectedVideo.title, url: `${window.location.origin}/feed/${selectedVideo.id}` })}
                  className="text-[#888] active:scale-90 transition-transform"
                >
                  <Share2 className="w-8 h-8" />
                </button>
              </div>

              {/* INSTRUCTOR + FOLLOW */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
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
                    {selectedVideo.users?.title && (
                      <p className="text-[#555] text-xs">{selectedVideo.users.title}</p>
                    )}
                  </div>
                </div>
                {user?.id !== selectedVideo.user_id && (
                  <button
                    onClick={() => handleFollow(selectedVideo.user_id)}
                    className={`text-sm font-bold px-5 py-2 rounded-full border transition flex-shrink-0 ${
                      following.has(selectedVideo.user_id)
                        ? 'border-[rgba(255,255,255,0.12)] text-[#666]'
                        : 'border-white text-white'
                    }`}
                  >
                    {following.has(selectedVideo.user_id) ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>

              <h2 className="text-white font-bold text-lg leading-snug mb-1.5">{selectedVideo.title}</h2>
              {selectedVideo.description && (
                <p className="text-[#555] text-sm leading-relaxed mb-2">{selectedVideo.description}</p>
              )}
              <p className="text-[#444] text-xs mb-6">{fmt(selectedVideo.views)} views · {selectedVideo.duration}</p>

              {/* COMMENTS LIST */}
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
                        <div>
                          <p className="text-white text-xs font-bold mb-0.5 flex items-center gap-1">
                            {c.users?.username}
                            {c.users?.verified && <VerifiedBadge size={11} />}
                          </p>
                          <p className="text-[#888] text-sm">{c.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="h-4" />
          </div>

          {/* COMMENT INPUT — pinned to bottom */}
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
