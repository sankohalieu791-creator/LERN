'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getFeed, getPublicFeed, deletePost, setPostReaction, getSignedFileUrl,
  incrementPostViews, amIFollowing, followUser, unfollowUser,
} from '@/lib/supabase'
import type { ReactionType } from '@/lib/types'
import { Eye, ThumbsUp, MessageCircle, Share2, Trash2, Play } from 'lucide-react'

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

// Rebuilt to match the actual old-app feed exactly: one full-bleed
// post after another (like a YouTube home feed), not padded cards in
// a column. Posting itself is out of scope for this pass — Feed is
// the only student screen being rebuilt right now, one at a time.
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
        {[0, 1].map(i => <div key={i} className="h-80 bg-[#1a1a1a] animate-pulse" />)}
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
  const viewedRef = useRef(false)
  const reactions: any[] = post.post_reactions || []
  const myReaction = reactions.find(r => r.user_id === user?.id)?.reaction as ReactionType | undefined
  const myReactionMeta = REACTIONS.find(r => r.key === myReaction && r.key !== 'thumbs_up')
  const isOwn = post.author_id === user?.id
  const canDelete = isOwn || (user && ['institution_staff', 'provider_staff'].includes((user as any).role))

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

  const remove = async () => { await deletePost(post.id); onChanged() }

  const totalReactions = reactions.length

  return (
    <div className="border-b border-white/10">
      {/* ── MEDIA ── */}
      {/* Space is reserved up front (same aspect box whether or not the
          signed URL has resolved yet) so the media popping in doesn't
          shove everything below it down mid-scroll. */}
      {(post.image_path || post.video_path) && (
        // Tall, near-square crop -- matches the reference exactly. The
        // previous wide 16:10 landscape box was the real reason
        // everything read as "small": a squat, low image makes the
        // whole post feel thin regardless of icon/text sizing.
        <div className="relative w-full aspect-[4/5] bg-black">
          {!mediaUrl && <div className="absolute inset-0 bg-[#1a1a1a] animate-pulse" />}
          {mediaUrl && post.video_path ? (
            <video src={mediaUrl} controls playsInline className="w-full h-full object-cover" />
          ) : mediaUrl ? (
            <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
          ) : null}
          {post.category && (
            <span className="absolute top-3 left-3 bg-[#1a1a1a]/90 text-white text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full">
              {post.category}
            </span>
          )}
          {post.title && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-10 pb-3 px-4">
              <p className="text-white font-bold text-[17px]">{post.title}</p>
            </div>
          )}
          {canDelete && (
            <button
              onClick={remove}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
            </button>
          )}
        </div>
      )}

      <div className="px-4 pt-3 pb-4">
        {/* ── AUTHOR ROW ── */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3A2E24] to-[#241C15] flex items-center justify-center text-white font-bold text-[12px] flex-shrink-0">
            {initials(post.author_name)}
          </div>
          <p className="font-bold text-white text-[14.5px] truncate flex-1">{post.author_name}</p>
          {!isOwn && following !== null && (
            <button
              onClick={toggleFollow}
              className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full flex-shrink-0 transition ${
                following ? 'bg-white/10 text-white' : 'bg-white text-black'
              }`}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {/* ── CAPTION (only when there's no title overlay, so text isn't shown twice) ── */}
        {post.content && !post.title && <p className="text-[#ccc] text-[14px] whitespace-pre-wrap leading-relaxed mb-2">{post.content}</p>}
        {post.content && post.title && <p className="text-[#999] text-[13.5px] whitespace-pre-wrap leading-relaxed mb-2">{post.content}</p>}

        {/* ── VIEWS + TIME ── */}
        <div className="flex items-center gap-1.5 text-[#777] text-[13.5px] mb-3">
          <Eye className="w-4 h-4" />
          <span>{(post.views_count || 0).toLocaleString()} views</span>
          <span>·</span>
          <span>{timeAgo(post.created_at)}</span>
        </div>

        {/* ── ACTIONS ── */}
        <div className="flex items-center gap-5 relative">
          {/* Shows the actual emoji you reacted with, not always a
              generic thumbs-up -- picking 🎉 should look like you
              picked 🎉, the same way a comment would carry your own
              words rather than everyone's comment looking identical. */}
          <button onClick={quickLike} className={`flex items-center gap-2 text-[14.5px] font-semibold ${myReaction ? 'text-brand' : 'text-white'}`}>
            {myReactionMeta ? (
              <span className="text-[22px] leading-none">{myReactionMeta.emoji}</span>
            ) : (
              <ThumbsUp className="w-6 h-6" />
            )}
            {totalReactions}
          </button>
          {/* Sits in the "comment" slot visually (matches the reference's
              speech-bubble glyph exactly) but opens the reaction picker,
              not a comment box -- there is no free-text commenting. */}
          <button onClick={() => setPickerOpen(v => !v)} className="text-white">
            <MessageCircle className="w-6 h-6" />
          </button>
          <button onClick={share} className="ml-auto text-white">
            <Share2 className="w-6 h-6" />
          </button>

          {pickerOpen && (
            <div className="absolute bottom-9 left-0 flex items-center gap-1 bg-[#1e1e1e] border border-white/10 rounded-full px-2 py-1.5 shadow-lg z-10">
              {REACTIONS.map(r => (
                <button
                  key={r.key} onClick={() => react(r.key)} title={r.label}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-[19px] transition ${myReaction === r.key ? 'bg-white/15' : 'hover:bg-white/10'}`}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
