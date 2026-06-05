'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageCircle, Share2, Send, Play } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getVideoById, likeVideo, unlikeVideo, hasUserLiked,
  followUser, unfollowUser, isFollowing,
  getComments, addComment,
} from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

function VerifiedBadge({ size = 13 }: { size?: number }) {
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

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K'
  return String(n)
}

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>()
  const { user } = useAuth()
  const router = useRouter()

  const [video,      setVideo]      = useState<any>(null)
  const [liked,      setLiked]      = useState(false)
  const [likeAnim,   setLikeAnim]   = useState(false)
  const [following,  setFollowing]  = useState(false)
  const [comments,   setComments]   = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading,    setLoading]    = useState(true)

  // Lock both html and body — must happen BEFORE layout so body padding-top
  // doesn't shift content. fixed inset-0 handles safe area internally.
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
    if (!postId) return
    const load = async () => {
      const { data } = await getVideoById(postId)
      setVideo(data)
      if (user && data) {
        const [l, f] = await Promise.all([
          hasUserLiked(postId, user.id),
          isFollowing(user.id, data.user_id),
        ])
        setLiked(!!l.data)
        setFollowing(!!f.data)
        try { await supabase.rpc('increment_video_views', { p_video_id: postId }) } catch {}
      }
      const { data: c } = await getComments(postId)
      setComments(c || [])
      setLoading(false)
    }
    load()
  }, [postId, user])

  const handleLike = async () => {
    if (!user || !video) return
    setLikeAnim(true)
    setTimeout(() => setLikeAnim(false), 350)
    if (liked) {
      await unlikeVideo(video.id, user.id)
      setLiked(false)
      setVideo((v: any) => ({ ...v, likes_count: Math.max(0, v.likes_count - 1) }))
    } else {
      await likeVideo(video.id, user.id)
      setLiked(true)
      setVideo((v: any) => ({ ...v, likes_count: v.likes_count + 1 }))
    }
  }

  const handleFollow = async () => {
    if (!user || !video) return
    if (following) {
      await unfollowUser(user.id, video.user_id)
      setFollowing(false)
    } else {
      await followUser(user.id, video.user_id)
      setFollowing(true)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newComment.trim() || !video) return
    await addComment(video.id, user.id, newComment.trim())
    setNewComment('')
    const { data } = await getComments(video.id)
    setComments(data || [])
    setVideo((v: any) => ({ ...v, comments_count: v.comments_count + 1 }))
  }

  // ── loading / error use fixed inset-0 so body padding-top doesn't shift them
  if (loading) return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#333] border-t-white rounded-full animate-spin" />
    </div>
  )

  if (!video) return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center">
      <div className="text-center">
        <p className="text-[#444] mb-4">Post not found</p>
        <button onClick={() => router.back()} className="text-white text-sm underline">Go back</button>
      </div>
    </div>
  )

  return (
    /* fixed inset-0 — positioned at exact viewport coords regardless of body padding */
    <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col">

      {/* VIDEO — marginTop pushes it below status bar */}
      <div
        className="relative w-full aspect-video bg-black flex-shrink-0"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        {video.video_url
          ? <video src={video.video_url} controls autoPlay playsInline className="w-full h-full" />
          : video.thumbnail_url
            ? <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] flex items-center justify-center">
                <Play className="w-12 h-12 text-white/50" />
              </div>
        }
        <button
          onClick={() => router.back()}
          className="absolute top-3 left-3 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* SCROLLABLE CONTENT — flex-1 gives it all remaining height so overflow-y works */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 pt-4">

          {/* ACTIONS */}
          <div className="flex items-center gap-6 mb-4">
            <button onClick={handleLike} className="flex items-center gap-2">
              <span className={likeAnim ? 'like-spin' : ''} style={{ display: 'inline-flex' }}>
                {liked
                  ? <ThumbsUp  className="w-8 h-8" fill="#ef4444" color="#ef4444" strokeWidth={1.5} />
                  : <ThumbsDown className="w-8 h-8" fill="none"    color="#888"    strokeWidth={1.5} />
                }
              </span>
              <span className={`text-base font-bold ${liked ? 'text-red-500' : 'text-[#888]'}`}>
                {fmt(video.likes_count)}
              </span>
            </button>
            <div className="flex items-center gap-2 text-[#888]">
              <MessageCircle className="w-8 h-8" />
              <span className="text-base font-bold">{fmt(video.comments_count)}</span>
            </div>
            <button
              onClick={() => navigator.share?.({ title: video.title, url: window.location.href })}
              className="text-[#888]"
            >
              <Share2 className="w-8 h-8" />
            </button>
          </div>

          {/* INSTRUCTOR */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
                {video.users?.avatar_url
                  ? <img src={video.users.avatar_url} className="w-full h-full object-cover" />
                  : video.users?.username?.[0]?.toUpperCase()
                }
              </div>
              <p className="text-white text-sm font-bold flex items-center gap-1.5">
                {video.users?.username}
                {video.users?.verified && <VerifiedBadge />}
              </p>
            </div>
            {user?.id !== video.user_id && (
              <button
                onClick={handleFollow}
                className={`text-sm font-bold px-4 py-1.5 rounded-full border transition ${
                  following ? 'border-[rgba(255,255,255,0.12)] text-[#666]' : 'border-white text-white'
                }`}
              >
                {following ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          <h2 className="text-white font-bold text-lg mb-1">{video.title}</h2>
          {video.description && <p className="text-[#555] text-sm mb-1">{video.description}</p>}
          <p className="text-[#444] text-xs mb-5">{fmt(video.views)} views · {video.duration}</p>

          {/* COMMENTS */}
          <div className="border-t border-[rgba(255,255,255,0.07)] pt-4">
            <p className="text-white font-bold mb-4">{comments.length} Comments</p>
            {comments.length === 0 ? (
              <p className="text-[#444] text-sm text-center py-6">No comments yet</p>
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
                    <div>
                      <p className="text-white text-xs font-bold mb-0.5">{c.users?.username}</p>
                      <p className="text-[#888] text-sm">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="h-4" />
        </div>
      </div>

      {/* STICKY COMMENT INPUT — always visible at bottom */}
      {user ? (
        <form
          onSubmit={handleAddComment}
          className="flex-shrink-0 px-4 py-3 border-t border-[rgba(255,255,255,0.07)] bg-[#111] flex gap-2 items-center"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
            {(user as any).avatar_url
              ? <img src={(user as any).avatar_url} className="w-full h-full object-cover" />
              : (user as any).username?.[0]?.toUpperCase()
            }
          </div>
          <input
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 bg-[#1e1e1e] border border-[rgba(255,255,255,0.15)] rounded-full px-4 py-3 text-white text-sm placeholder-[#555] outline-none focus:border-[rgba(255,255,255,0.3)] transition"
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
        <div
          className="flex-shrink-0 px-4 py-4 text-center border-t border-[rgba(255,255,255,0.08)] bg-[#111]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
        >
          <p className="text-[#444] text-sm">Sign in to comment</p>
        </div>
      )}
    </div>
  )
}
