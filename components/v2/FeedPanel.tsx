'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getFeed, getPublicFeed, setPostReaction, getSignedFileUrl, incrementPostViews,
} from '@/lib/supabase'
import type { ReactionType } from '@/lib/types'
import { Play, X, CheckCircle2 } from 'lucide-react'

// Build Spec: Feed and My Work (student) v1.0, Part 1. Structural
// colours (card bg, hairlines) stay this app's own dark palette, same
// call as every other rebuild this session -- every PINNED accent hex
// (avatar, verified tick, reaction pills) is used exactly as given.
//
// "Reactions are the only interaction" is literal here: no comments
// (never existed), no DMs (never existed), and as of this rebuild no
// Follow/Share/view-count on the card either -- the previous version
// had all three, none of which the spec mentions, and it explicitly
// scopes interaction down to reactions alone. Views are still counted
// server-side (incrementPostViews) since that's just a read metric an
// org can see, never shown back to a student reading their own feed.
const REACTIONS: { key: ReactionType; label: string; emoji: string }[] = [
  { key: 'congratulations', label: 'Celebrate', emoji: '🎉' },
  { key: 'well_done', label: 'Well done', emoji: '👏' },
  { key: 'keep_going', label: 'Keep going', emoji: '🔥' },
  { key: 'proud', label: 'Proud', emoji: '⭐' },
]

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
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
      <div className="max-w-[420px] mx-auto px-4 py-4 space-y-[18px]">
        {[0, 1].map(i => <div key={i} className="h-[340px] rounded-[14px] bg-[#1a1a1a] animate-pulse" />)}
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
    <div className="max-w-[420px] mx-auto">
      {exploring && (
        <div className="bg-[#1a1a1a] border-b border-white/10 px-4 py-3">
          <p className="text-[12.5px] text-[#999]">
            You're seeing public educational content only — link to your organisation in My Work to see everything.
          </p>
        </div>
      )}
      <div className="px-4 py-4 space-y-[18px]">
        {posts.map(p => <PostCard key={p.id} post={p} onChanged={load} />)}
      </div>
    </div>
  )
}

function PostCard({ post, onChanged }: { post: any; onChanged: () => void }) {
  const { user } = useAuth()
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [playerOpen, setPlayerOpen] = useState(false)
  const viewedRef = useRef(false)
  const reactions: any[] = post.post_reactions || []
  const myReaction = reactions.find(r => r.user_id === user?.id)?.reaction as ReactionType | undefined
  const totalReactions = reactions.length

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

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-[14px] overflow-hidden">
      {/* ── AUTHOR ROW ── */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3">
        <span className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
          {initials(post.author_name)}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white flex items-center gap-1 truncate">
            {post.author_name}
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#0F6E56' }} />
          </p>
          <p className="text-[11px]" style={{ color: '#999' }}>
            {[post.category, timeAgo(post.created_at)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* ── MEDIA: full-width, ~240px ── */}
      {(post.image_path || post.video_path) && (
        <div
          className="relative w-full bg-[#141414] overflow-hidden"
          style={{ height: 240 }}
          onClick={() => post.video_path && mediaUrl && setPlayerOpen(true)}
        >
          {!mediaUrl && <div className="absolute inset-0 bg-[#141414] animate-pulse" />}
          {mediaUrl && post.video_path ? (
            <>
              <video
                src={mediaUrl} muted playsInline preload="metadata" className="w-full h-full object-cover"
                onClick={() => setPlayerOpen(true)}
                onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
              />
              <button
                onClick={() => setPlayerOpen(true)} aria-label="Play video"
                className="absolute inset-0 flex items-center justify-center bg-black/10"
              >
                <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
                  <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                </div>
              </button>
              {duration !== null && (
                <span className="absolute bottom-2.5 right-2.5 text-[11px] font-semibold bg-black/70 text-white px-2 py-0.5 rounded">
                  {fmtDuration(duration)}
                </span>
              )}
            </>
          ) : mediaUrl ? (
            <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
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

      {/* ── REACTIONS ── */}
      <div className="flex items-center gap-1.5 px-4 py-3.5 flex-wrap">
        {REACTIONS.map(r => (
          <button
            key={r.key} onClick={() => react(r.key)}
            className="flex items-center gap-1.5 rounded-full border transition"
            style={{
              borderColor: myReaction === r.key ? '#F26B21' : 'rgba(255,255,255,0.1)',
              backgroundColor: myReaction === r.key ? 'rgba(242,107,33,0.12)' : '#141414',
              padding: '6px 12px',
            }}
          >
            <span className="text-[13px] leading-none">{r.emoji}</span>
            <span className="text-[11.5px] font-medium" style={{ color: myReaction === r.key ? '#F26B21' : '#999' }}>{r.label}</span>
          </button>
        ))}
        {totalReactions > 0 && <span className="text-[12px] ml-auto flex-shrink-0" style={{ color: '#999' }}>{totalReactions}</span>}
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
