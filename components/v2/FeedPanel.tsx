'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getFeed, getPublicFeed, setPostReaction, getSignedFileUrl,
  incrementPostViews, amIFollowing, followUser, unfollowUser,
} from '@/lib/supabase'
import type { ReactionType } from '@/lib/types'
import { Eye, ThumbsUp, MessageCircle, Share2, Play, X } from 'lucide-react'

// Sizes/structure here are pulled directly from the actual deleted v1
// app/feed/page.tsx (git show a07a8c2~1), not eyeballed off a
// screenshot: a fixed 230px media block (not an aspect-ratio box --
// that's what kept overshooting), text-xs/text-sm throughout, 36px
// avatar, 20px action icons. Guessed pixel bumps kept swinging both
// directions -- this is ground truth.
//
// Fixed positive set only — no open free-text comments anywhere. The
// second action slot (where a comment button would be on most feeds)
// opens this same picker instead of a comment box.
const REACTIONS: { key: ReactionType; label: string; emoji: string }[] = [
  { key: 'congratulations', label: 'Congratulations', emoji: '🎉' },
  { key: 'well_done', label: 'Well done', emoji: '👏' },
  { key: 'keep_going', label: 'Keep going', emoji: '💪' },
  { key: 'thumbs_up', label: 'Thumbs up', emoji: '👍' },
  { key: 'celebrate_lern', label: 'LERN celebrate', emoji: '🧡' },
]

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
      <div className="space-y-1">
        {[0, 1].map(i => <div key={i} className="h-[230px] bg-[#1a1a1a] animate-pulse" />)}
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
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [following, setFollowing] = useState<boolean | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [playerOpen, setPlayerOpen] = useState(false)
  const viewedRef = useRef(false)
  const reactions: any[] = post.post_reactions || []
  const myReaction = reactions.find(r => r.user_id === user?.id)?.reaction as ReactionType | undefined
  const myReactionMeta = REACTIONS.find(r => r.key === myReaction && r.key !== 'thumbs_up')
  const isOwn = post.author_id === user?.id

  useEffect(() => {
    if (post.image_path) getSignedFileUrl('post-images', post.image_path).then(({ url }) => setMediaUrl(url))
    else if (post.video_path) getSignedFileUrl('post-videos', post.video_path).then(({ url }) => setMediaUrl(url))
  }, [post.image_path, post.video_path])

  useEffect(() => {
    if (viewedRef.current) return
    viewedRef.current = true
    incrementPostViews(post.id)
  }, [post.id])

  useEffect(() => {
    if (!user || isOwn) return
    amIFollowing(user.id, post.author_id).then(setFollowing)
  }, [user?.id, post.author_id, isOwn])

  const toggleFollow = async () => {
    if (!user) return
    if (following) { await unfollowUser(user.id, post.author_id); setFollowing(false) }
    else { await followUser(user.id, post.author_id); setFollowing(true) }
  }

  // Tapping the main button reacts thumbs-up by default; tapping it
  // again while ANY reaction is set (thumbs-up or a picked emoji)
  // clears it, rather than always forcing it specifically to thumbs-up.
  const quickLike = async () => {
    if (!user) return
    await setPostReaction(post.id, user.id, myReaction ? null : 'thumbs_up')
    onChanged()
  }

  const react = async (key: ReactionType) => {
    if (!user) return
    await setPostReaction(post.id, user.id, myReaction === key ? null : key)
    setPickerOpen(false)
    onChanged()
  }

  const share = async () => {
    const text = `${post.title || post.content || 'Check this out on LERN'}`
    const shareData = { title: 'LERN', text, url: typeof window !== 'undefined' ? window.location.origin : undefined }
    try {
      if (navigator.share) await navigator.share(shareData)
      else { await navigator.clipboard.writeText(`${text} — ${shareData.url}`); }
    } catch {}
  }

  const totalReactions = reactions.length

  return (
    <div className="border-b border-white/5">
      {/* ── MEDIA: fixed 230px, not an aspect box ── */}
      {/* A video is a thumbnail here, not an inline player -- tapping it
          opens a proper full-screen player (like tapping a YouTube
          thumbnail), instead of playing small and muted-by-default
          right in the feed. */}
      {(post.image_path || post.video_path) && (
        <div
          className="relative w-full bg-[#1a1a1a] overflow-hidden"
          style={{ height: 230 }}
          onClick={() => post.video_path && mediaUrl && setPlayerOpen(true)}
        >
          {!mediaUrl && <div className="absolute inset-0 bg-[#1a1a1a] animate-pulse" />}
          {mediaUrl && post.video_path ? (
            <>
              <video src={mediaUrl} muted playsInline preload="metadata" className="w-full h-full object-cover" onClick={() => setPlayerOpen(true)} />
              <button
                onClick={() => setPlayerOpen(true)} aria-label="Play video"
                className="absolute inset-0 flex items-center justify-center bg-black/10"
              >
                <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
                  <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                </div>
              </button>
            </>
          ) : mediaUrl ? (
            <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
          ) : null}
          {post.category && (
            <span className="absolute top-2.5 left-2.5 text-[10px] font-bold bg-black/70 text-white px-2.5 py-1 rounded-full uppercase tracking-wide">
              {post.category}
            </span>
          )}
          {post.title && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pt-8 pb-3">
              <h3 className="text-white font-bold text-[15px] leading-snug line-clamp-2">{post.title}</h3>
            </div>
          )}
        </div>
      )}

      <div className="px-4 pt-3 pb-1">
        {/* ── AUTHOR ROW ── */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3A2E24] to-[#241C15] flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0">
              {initials(post.author_name)}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-bold truncate leading-none mb-0.5">{post.author_name}</p>
              {post.author_role && <p className="text-[#555] text-xs truncate">{post.author_role === 'institution_staff' || post.author_role === 'provider_staff' ? 'Instructor' : 'Student'}</p>}
            </div>
          </div>
          {!isOwn && following !== null && (
            <button
              onClick={toggleFollow}
              className={`flex-shrink-0 text-[12px] font-bold px-4 py-1.5 rounded-full border transition ${
                following ? 'border-white/10 text-[#444]' : 'border-white text-white'
              }`}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {/* ── CAPTION (only when there's no title overlay, so text isn't shown twice) ── */}
        {post.content && !post.title && <p className="text-[#999] text-sm line-clamp-2 mb-2 leading-snug">{post.content}</p>}

        {/* ── VIEWS + TIME ── */}
        <div className="flex items-center gap-3 text-[#555] text-xs mb-3">
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{(post.views_count || 0).toLocaleString()} views</span>
          <span>{timeAgo(post.created_at)}</span>
        </div>

        {/* ── ACTIONS ── */}
        <div className="flex items-center gap-4 pb-4 relative">
          {/* Pure like/unlike -- always the same ThumbsUp glyph, just
              filled red when you've reacted at all. Doesn't change
              shape based on which emoji you picked; that's shown
              separately, next to it, not fused into this button. */}
          <button onClick={quickLike} className="flex items-center gap-1.5 active:scale-90 transition-transform">
            <ThumbsUp className="w-5 h-5" fill={myReaction ? '#ef4444' : 'none'} color={myReaction ? '#ef4444' : '#555'} strokeWidth={1.5} />
            <span className={`text-sm font-semibold ${myReaction ? 'text-red-500' : 'text-[#555]'}`}>{totalReactions}</span>
          </button>
          {/* The picked reaction, shown as its own small badge next to
              Like -- like LinkedIn's reaction indicator -- rather than
              replacing the Like button's own icon. */}
          {myReactionMeta && (
            <span className="text-[16px] leading-none" title={myReactionMeta.label}>{myReactionMeta.emoji}</span>
          )}
          {/* Sits in the "comment" slot visually but opens the reaction
              picker, not a comment box -- there is no free-text
              commenting. */}
          <button onClick={() => setPickerOpen(v => !v)} className="flex items-center gap-1.5 text-[#555] active:scale-90 transition-transform">
            <MessageCircle className="w-5 h-5" />
          </button>
          <button onClick={share} className="text-[#555] active:scale-90 transition-transform ml-auto">
            <Share2 className="w-5 h-5" />
          </button>

          {pickerOpen && (
            <div className="absolute bottom-12 left-0 flex items-center gap-1 bg-[#1e1e1e] border border-white/10 rounded-full px-2 py-1.5 shadow-lg z-10">
              {REACTIONS.map(r => (
                <button
                  key={r.key} onClick={() => react(r.key)} title={r.label}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[17px] transition ${myReaction === r.key ? 'bg-white/15' : 'hover:bg-white/10'}`}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
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
