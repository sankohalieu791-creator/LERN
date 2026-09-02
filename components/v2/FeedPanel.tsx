'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getFeed, getPublicFeed, setPostReaction, toggleLike, getSignedFileUrl, incrementPostViews,
} from '@/lib/supabase'
import type { ReactionType } from '@/lib/types'
import { Heart, Play, X } from 'lucide-react'

// Feed, revised: edge-to-edge like Instagram actually is on a phone
// (no card border/radius, no outer side margin -- those made it read
// as a floating box rather than a real full-width feed), a real Like
// on the left plus exactly 2 sticker reactions on the right (chosen by
// the POST'S AUTHOR at posting time via PostComposer's own sticker
// picker, not fixed globally), and inline autoplay video instead of a
// tap-to-open full-screen player.
const ALL_REACTIONS: { key: ReactionType; label: string; emoji: string }[] = [
  { key: 'congratulations', label: 'Celebrate', emoji: '🎉' },
  { key: 'well_done', label: 'Well done', emoji: '👏' },
  { key: 'keep_going', label: 'Keep going', emoji: '🔥' },
  { key: 'proud', label: 'Proud', emoji: '⭐' },
]
const REACTION_BY_KEY = Object.fromEntries(ALL_REACTIONS.map(r => [r.key, r]))

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function FeedPanel() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const exploring = !user?.organisation_id

  const load = () => {
    (exploring ? getPublicFeed() : getFeed(user!.organisation_id!)).then(({ data }) => { setPosts(data || []); setLoading(false) })
  }
  useEffect(load, [user?.organisation_id])

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-4">
        {[0, 1].map(i => <div key={i} className="h-[340px] rounded-xl bg-[#1a1a1a] animate-pulse" />)}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-20 px-6">
        <p className="font-semibold text-white text-[15px] mb-1">Nothing here yet</p>
        <p className="text-[13px] text-[#666]">
          {exploring ? 'Public educational content will show up here.' : "Your organisation's posts will show up here."}
        </p>
      </div>
    )
  }

  return (
    <div>
      {exploring && (
        <div className="bg-[#1a1a1a] border-b border-white/10 px-4 py-3">
          <p className="text-[12.5px] text-[#999]">
            You're seeing public educational content only — link to your organisation in My Work to see everything.
          </p>
        </div>
      )}
      {posts.map(p => <PostCard key={p.id} post={p} onChanged={load} />)}
    </div>
  )
}

function PostCard({ post, onChanged }: { post: any; onChanged: () => void }) {
  const { user } = useAuth()
  const router = useRouter()
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [playerOpen, setPlayerOpen] = useState(false)
  const viewedRef = useRef(false)
  const reactions: any[] = post.post_reactions || []
  const likes: any[] = post.post_likes || []
  const myReaction = reactions.find(r => r.user_id === user?.id)?.reaction as ReactionType | undefined
  const liked = likes.some(l => l.user_id === user?.id)

  // Falls back to the first 2 of the full set for any post created
  // before this -- sticker_choices is null on those, never an empty
  // pick, so there's always something to react with.
  const stickers = (post.sticker_choices && post.sticker_choices.length > 0
    ? post.sticker_choices.map((k: string) => REACTION_BY_KEY[k]).filter(Boolean)
    : ALL_REACTIONS.slice(0, 2)) as typeof ALL_REACTIONS

  useEffect(() => {
    if (post.image_path) getSignedFileUrl('post-images', post.image_path).then(({ url }) => setMediaUrl(url))
    else if (post.video_path) getSignedFileUrl('post-videos', post.video_path).then(({ url }) => setMediaUrl(url))
  }, [post.image_path, post.video_path])

  useEffect(() => {
    if (viewedRef.current) return
    viewedRef.current = true
    incrementPostViews(post.id)
  }, [post.id])

  const react = async (key: ReactionType) => {
    if (!user) return
    await setPostReaction(post.id, user.id, myReaction === key ? null : key)
    onChanged()
  }

  const like = async () => {
    if (!user) return
    await toggleLike(post.id, user.id, !liked)
    onChanged()
  }

  return (
    <div className="border-b border-white/10">
      {/* ── AUTHOR ROW -- tapping opens their profile, own view if it's
          you, public view otherwise ── */}
      <button
        onClick={() => router.push(post.author_id === user?.id ? '/student/profile' : `/student/profile/${post.author_id}`)}
        className="w-full flex items-center gap-2.5 px-4 pt-3.5 pb-2.5 text-left"
      >
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
          {initials(post.author_name)}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">{post.author_name}</p>
          <p className="text-[11px]" style={{ color: '#999' }}>
            {[post.category, timeAgo(post.created_at)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </button>

      {/* ── MEDIA: full-bleed, edge to edge. A video is a thumbnail
          here (like tapping a YouTube thumbnail), not autoplaying
          inline -- tapping opens the real full-screen player below. ── */}
      {(post.image_path || post.video_path) && (
        <div
          className="relative w-full bg-[#141414]" style={{ minHeight: 240 }}
          onClick={() => post.video_path && mediaUrl && setPlayerOpen(true)}
        >
          {!mediaUrl && <div className="absolute inset-0 bg-[#141414] animate-pulse" style={{ height: 240 }} />}
          {mediaUrl && post.video_path ? (
            <>
              <video src={mediaUrl} muted playsInline preload="metadata" className="w-full max-h-[520px] object-cover" />
              <button aria-label="Play video" className="absolute inset-0 flex items-center justify-center bg-black/10">
                <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
                  <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                </div>
              </button>
            </>
          ) : mediaUrl ? (
            <img src={mediaUrl} alt="" className="w-full max-h-[520px] object-cover" />
          ) : null}
        </div>
      )}

      {/* ── CAPTION ── */}
      {(post.title || post.content) && (
        <div className="px-4 pt-3">
          {post.title && <p className="text-[13px] font-semibold text-white leading-[1.5] mb-0.5">{post.title}</p>}
          {post.content && <p className="text-[13px] text-[#ccc] leading-[1.5]">{post.content}</p>}
        </div>
      )}

      {/* ── LIKE (left) + up to 2 chosen stickers (right) ── */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <button onClick={like} className="flex items-center gap-1.5 active:scale-90 transition-transform">
          <Heart className="w-5 h-5" fill={liked ? '#F26B21' : 'none'} color={liked ? '#F26B21' : '#999'} strokeWidth={1.75} />
          {likes.length > 0 && <span className="text-[13px] font-semibold" style={{ color: liked ? '#F26B21' : '#999' }}>{likes.length}</span>}
        </button>
        <div className="flex items-center gap-1.5">
          {stickers.map(r => (
            <button
              key={r.key} onClick={() => react(r.key)} title={r.label}
              className="flex items-center gap-1 rounded-full border transition"
              style={{
                borderColor: myReaction === r.key ? '#F26B21' : 'rgba(255,255,255,0.1)',
                backgroundColor: myReaction === r.key ? 'rgba(242,107,33,0.12)' : '#141414',
                padding: '5px 10px',
              }}
            >
              <span className="text-[14px] leading-none">{r.emoji}</span>
            </button>
          ))}
          {reactions.length > 0 && <span className="text-[12px] ml-1" style={{ color: '#999' }}>{reactions.length}</span>}
        </div>
      </div>

      {playerOpen && mediaUrl && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <button onClick={() => setPlayerOpen(false)} className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center" style={{ marginTop: 'env(safe-area-inset-top)' }}>
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 flex items-center justify-center">
            <video src={mediaUrl} controls autoPlay playsInline className="max-h-full max-w-full" />
          </div>
        </div>
      )}
    </div>
  )
}
