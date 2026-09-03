'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getFeed, getPublicFeed, setPostReaction, toggleLike, getSignedFileUrl, incrementPostViews, getPostsByAuthor,
} from '@/lib/supabase'
import type { ReactionType } from '@/lib/types'
import { ThumbsUp, Play, X, PartyPopper, Award, Flame, Star, Eye } from 'lucide-react'

// Feed, LinkedIn-modelled per direct feedback: distinct post "cards"
// separated by a real gap (page background showing through between
// them), not edge-to-edge Instagram-style touching each other with
// only a hairline divider -- each card still spans the full screen
// width itself (touches both side edges), media is full-width WITHIN
// that card. ThumbsUp for the like (LinkedIn's own icon), not a heart.
// Reactions were raw emoji (🎉👏🔥⭐) -- flagged as "confusing, needs
// to be professional" for a platform employers and institutions also
// use. Same four concepts, drawn as real icons instead.
const ALL_REACTIONS: { key: ReactionType; label: string; icon: any }[] = [
  { key: 'congratulations', label: 'Celebrate', icon: PartyPopper },
  { key: 'well_done', label: 'Well done', icon: Award },
  { key: 'keep_going', label: 'Keep going', icon: Flame },
  { key: 'proud', label: 'Proud', icon: Star },
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
        {[0, 1].map(i => <div key={i} className="h-[340px] rounded-xl bg-[var(--app-surface)] animate-pulse" />)}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-20 px-6">
        <p className="font-semibold text-[var(--app-text)] text-[15px] mb-1">Nothing here yet</p>
        <p className="text-[13px] text-[var(--app-text-tertiary)]">
          {exploring ? 'Public educational content will show up here.' : "Your organisation's posts will show up here."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 pb-2">
      {exploring && (
        <div className="bg-[var(--app-surface)] border-b border-[var(--app-border)] px-4 py-3">
          <p className="text-[12.5px] text-[var(--app-text-secondary)]">
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
    <div className="bg-[var(--app-surface)]">
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
          <p className="text-[13px] font-semibold text-[var(--app-text)] truncate">{post.author_name}</p>
          <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--app-text-secondary)' }}>
            {[post.category, timeAgo(post.created_at)].filter(Boolean).join(' · ')}
            {typeof post.views_count === 'number' && (
              <span className="flex items-center gap-0.5">· <Eye className="w-3 h-3" /> {post.views_count}</span>
            )}
          </p>
        </div>
      </button>

      {/* ── MEDIA: full-bleed, edge to edge. A video is a thumbnail
          here (like tapping a YouTube thumbnail), not autoplaying
          inline -- tapping opens the real full-screen player below.
          aspect-video (16:9), not a tall max-h-[520px] crop -- a
          YouTube thumbnail card is short and wide, not a portrait
          Instagram-style crop, which was "the feed card too tall". ── */}
      {(post.image_path || post.video_path) && (
        <div
          className="relative w-full aspect-video bg-[var(--app-surface-2)]"
          onClick={() => post.video_path && mediaUrl && setPlayerOpen(true)}
        >
          {!mediaUrl && <div className="absolute inset-0 bg-[var(--app-surface-2)] animate-pulse" />}
          {mediaUrl && post.video_path ? (
            <>
              <video src={mediaUrl} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
              <button aria-label="Play video" className="absolute inset-0 flex items-center justify-center bg-black/10">
                <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
                  <Play className="w-6 h-6 text-[var(--app-text)] fill-white ml-0.5" />
                </div>
              </button>
            </>
          ) : mediaUrl ? (
            <img src={mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : null}
        </div>
      )}

      {/* ── CAPTION ── */}
      {(post.title || post.content) && (
        <div className="px-4 pt-3">
          {post.title && <p className="text-[13px] font-semibold text-[var(--app-text)] leading-[1.5] mb-0.5">{post.title}</p>}
          {post.content && <p className="text-[13px] text-[var(--app-text-body)] leading-[1.5]">{post.content}</p>}
        </div>
      )}

      {/* ── LIKE (left) + up to 2 chosen stickers (right) ── */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <button onClick={like} className="flex items-center gap-1.5 active:scale-90 transition-transform">
          <ThumbsUp className="w-5 h-5" fill={liked ? '#F26B21' : 'none'} color={liked ? '#F26B21' : 'var(--app-text-secondary)'} strokeWidth={1.75} />
          {likes.length > 0 && <span className="text-[13px] font-semibold" style={{ color: liked ? '#F26B21' : 'var(--app-text-secondary)' }}>{likes.length}</span>}
        </button>
        <div className="flex items-center gap-1.5">
          {stickers.map(r => (
            <button
              key={r.key} onClick={() => react(r.key)} title={r.label}
              className="flex items-center gap-1 rounded-full border transition"
              style={{
                borderColor: myReaction === r.key ? '#F26B21' : 'var(--app-overlay-2)',
                backgroundColor: myReaction === r.key ? 'rgba(242,107,33,0.12)' : 'var(--app-surface-2)',
                padding: '5px 10px',
              }}
            >
              <r.icon className="w-3.5 h-3.5" style={{ color: myReaction === r.key ? '#F26B21' : 'var(--app-text-secondary)' }} />
            </button>
          ))}
          {reactions.length > 0 && <span className="text-[12px] ml-1" style={{ color: 'var(--app-text-secondary)' }}>{reactions.length}</span>}
        </div>
      </div>

      {playerOpen && mediaUrl && (
        <VideoPlayerOverlay initialPost={post} initialUrl={mediaUrl} onClose={() => setPlayerOpen(false)} />
      )}
    </div>
  )
}

// YouTube-style: tap a video, it opens fullscreen -- but what's listed
// below the player is only ever THIS author's other videos, not an
// algorithmic mix of everyone else's the way YouTube's own "up next"
// would be ("underneath you'll see the videos of that person only").
// Player chrome stays fixed black regardless of theme on purpose --
// same convention as YouTube's own fullscreen player, or PostComposer's
// camera screens: a video surface, not a themed page.
function VideoPlayerOverlay({ initialPost, initialUrl, onClose }: { initialPost: any; initialUrl: string; onClose: () => void }) {
  const router = useRouter()
  const [activePost, setActivePost] = useState(initialPost)
  const [activeUrl, setActiveUrl] = useState(initialUrl)
  const [more, setMore] = useState<any[]>([])

  useEffect(() => {
    getPostsByAuthor(activePost.author_id, activePost.id).then(({ data }) => setMore(data || []))
  }, [activePost.author_id, activePost.id])

  const playOther = async (p: any) => {
    const { url } = await getSignedFileUrl('post-videos', p.video_path)
    if (url) { setActivePost(p); setActiveUrl(url) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-y-auto overscroll-contain" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <button onClick={onClose} className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center" style={{ marginTop: 'env(safe-area-inset-top)' }}>
        <X className="w-5 h-5 text-white" />
      </button>
      <div className="w-full flex items-center justify-center bg-black flex-shrink-0">
        <video key={activePost.id} src={activeUrl} controls autoPlay playsInline className="max-h-[65vh] max-w-full" />
      </div>

      <button
        onClick={() => router.push(activePost.author_id ? `/student/profile/${activePost.author_id}` : '/student/profile')}
        className="w-full flex items-center gap-2.5 px-4 py-3 flex-shrink-0 text-left"
      >
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
          {initials(activePost.author_name)}
        </span>
        <div className="min-w-0">
          <p className="text-white text-[13px] font-semibold truncate">{activePost.author_name}</p>
          {(activePost.title || activePost.content) && <p className="text-white/60 text-[12px] mt-0.5 line-clamp-2">{activePost.title || activePost.content}</p>}
        </div>
      </button>

      {more.length > 0 && (
        <div className="px-4 pb-8 flex-1">
          <p className="text-white/40 text-[11px] font-bold uppercase tracking-wide mb-2 mt-1">More from {activePost.author_name}</p>
          <div className="space-y-2">
            {more.map(p => <MoreFromAuthorRow key={p.id} post={p} onPlay={() => playOther(p)} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function MoreFromAuthorRow({ post, onPlay }: { post: any; onPlay: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null)
  useEffect(() => { if (post.video_path) getSignedFileUrl('post-videos', post.video_path).then(({ url }) => setThumb(url)) }, [post.video_path])
  return (
    <button onClick={onPlay} className="w-full flex items-center gap-3 bg-white/5 rounded-xl p-2 text-left">
      <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
        {thumb && <video src={thumb} className="w-full h-full object-cover" muted preload="metadata" />}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Play className="w-5 h-5 text-white fill-white" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-white text-[13px] font-medium line-clamp-2">{post.title || post.content || 'Untitled'}</p>
        <p className="text-white/50 text-[11px] mt-0.5">{timeAgo(post.created_at)}</p>
      </div>
    </button>
  )
}
