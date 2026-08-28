'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getFeed, getPublicFeed, createPost, deletePost, uploadPostImage, setPostReaction, getSignedFileUrl } from '@/lib/supabase'
import type { ReactionType } from '@/lib/types'
import { ImagePlus, X, Globe, Users, Trash2, PartyPopper } from 'lucide-react'

// Fixed positive set only — no open free-text comments anywhere. One
// custom LERN-branded reaction (celebrate_lern) alongside plain ones.
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
  // Explore mode: no organisation yet. Public, safe educational content
  // only — fully inert otherwise (no composer, no reacting isn't blocked
  // by RLS but there's nothing here to build a profile from either way).
  const exploring = !user?.organisation_id

  const load = () => {
    (exploring ? getPublicFeed() : getFeed(user!.organisation_id!)).then(({ data }) => { setPosts(data || []); setLoading(false) })
  }
  useEffect(load, [user?.organisation_id])

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {exploring ? (
        <div className="bg-surface-subtle border border-edge rounded-2xl px-5 py-4">
          <p className="text-[13px] text-ink-secondary">
            You're not linked to an organisation yet, so you're only seeing public educational content — you can look around, but you can't post or be seen by anyone. Enter your join code in My Work to unlock everything.
          </p>
        </div>
      ) : (
        <Composer onPosted={load} />
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-surface-muted animate-pulse" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl p-10 text-center">
          <p className="font-semibold text-ink text-[14px] mb-1">Nothing here yet</p>
          <p className="text-[13px] text-ink-tertiary">Educational updates and celebrations {exploring ? '' : 'from your organisation '}will show up here.</p>
        </div>
      ) : (
        posts.map(p => <PostCard key={p.id} post={p} onChanged={load} />)
      )}
    </div>
  )
}

function Composer({ onPosted }: { onPosted: () => void }) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<'organisation' | 'public'>('organisation')
  const [posting, setPosting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const isAdult = user?.date_of_birth ? (Date.now() - new Date(user.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25) >= 18 : false

  const pickFile = (f: File | null) => {
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  const handlePost = async () => {
    if (!content.trim() && !file) return
    if (!user?.organisation_id) return
    setPosting(true)
    let image_path: string | undefined
    if (file) {
      const { path, error } = await uploadPostImage(user.id, file)
      if (error || !path) { setPosting(false); return }
      image_path = path
    }
    await createPost(user.organisation_id, user.id, { content: content.trim() || undefined, image_path, visibility })
    setPosting(false)
    setContent(''); pickFile(null); setVisibility('organisation')
    onPosted()
  }

  return (
    // Posting is a phone action, per spec -- the composer only appears at
    // phone widths. On laptop the feed is browse-only.
    <div className="lg:hidden bg-surface border border-edge rounded-2xl p-4">
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-full bg-surface-muted flex items-center justify-center text-[12px] font-bold text-ink-secondary flex-shrink-0">
          {initials(user?.full_name)}
        </div>
        <textarea
          value={content} onChange={e => setContent(e.target.value)}
          placeholder="Share something educational…"
          rows={2}
          className="flex-1 text-[14px] text-ink placeholder-ink-quaternary outline-none resize-none"
        />
      </div>
      {preview && (
        <div className="relative mt-2 ml-11">
          <img src={preview} alt="" className="max-h-48 rounded-xl border border-edge" />
          <button onClick={() => pickFile(null)} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mt-3 ml-11">
        <div className="flex items-center gap-1">
          <button onClick={() => fileRef.current?.click()} className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-secondary hover:bg-surface-muted transition">
            <ImagePlus className="w-4 h-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pickFile(e.target.files?.[0] || null)} />
          {isAdult && (
            <button
              onClick={() => setVisibility(v => v === 'organisation' ? 'public' : 'organisation')}
              className="flex items-center gap-1 text-[11px] font-semibold text-ink-secondary px-2 py-1 rounded-lg hover:bg-surface-muted transition"
            >
              {visibility === 'public' ? <Globe className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
              {visibility === 'public' ? 'Public' : 'Organisation only'}
            </button>
          )}
        </div>
        <button
          onClick={handlePost} disabled={posting || (!content.trim() && !file)}
          className="bg-brand text-white font-semibold text-[13px] px-4 py-1.5 rounded-lg disabled:opacity-40 transition"
        >
          {posting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  )
}

function PostCard({ post, onChanged }: { post: any; onChanged: () => void }) {
  const { user } = useAuth()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const reactions: any[] = post.post_reactions || []
  const myReaction = reactions.find(r => r.user_id === user?.id)?.reaction as ReactionType | undefined
  const canDelete = post.author_id === user?.id || (user && ['institution_staff', 'provider_staff'].includes((user as any).role))

  useEffect(() => {
    if (post.image_path) getSignedFileUrl('post-images', post.image_path).then(({ url }) => setImageUrl(url))
  }, [post.image_path])

  const react = async (key: ReactionType) => {
    if (!user) return
    await setPostReaction(post.id, user.id, myReaction === key ? null : key)
    onChanged()
  }

  const remove = async () => {
    await deletePost(post.id)
    onChanged()
  }

  const counts = REACTIONS.map(r => ({ ...r, count: reactions.filter(x => x.reaction === r.key).length })).filter(r => r.count > 0)

  return (
    <div className="bg-surface border border-edge rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-surface-muted flex items-center justify-center text-[12px] font-bold text-ink-secondary flex-shrink-0">
            {initials(post.users?.full_name)}
          </div>
          <div>
            <p className="font-semibold text-ink text-[13.5px]">{post.users?.full_name}</p>
            <p className="text-[11px] text-ink-tertiary flex items-center gap-1">
              {timeAgo(post.created_at)} · {post.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Users className="w-3 h-3" />}
            </p>
          </div>
        </div>
        {canDelete && (
          <button onClick={remove} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-quaternary hover:text-danger-text hover:bg-danger-bg transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {post.content && <p className="text-[14px] text-ink-body whitespace-pre-wrap mb-2.5 leading-relaxed">{post.content}</p>}
      {imageUrl && <img src={imageUrl} alt="" className="w-full rounded-xl border border-edge-subtle mb-2.5" />}

      {counts.length > 0 && (
        <div className="flex items-center gap-1 mb-2 text-[12px] text-ink-tertiary">
          {counts.map(c => <span key={c.key}>{c.emoji}</span>)}
          <span className="ml-1">{reactions.length}</span>
        </div>
      )}

      <div className="flex items-center gap-1 pt-2.5 border-t border-edge-subtle">
        {REACTIONS.map(r => (
          <button
            key={r.key} onClick={() => react(r.key)} title={r.label}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition ${
              myReaction === r.key ? 'bg-accent-bg text-brand' : 'text-ink-secondary hover:bg-surface-muted'
            }`}
          >
            <span>{r.emoji}</span>
            <span className="hidden sm:inline">{r.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
