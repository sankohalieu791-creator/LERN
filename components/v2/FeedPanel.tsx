'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getFeed, setPostReaction, getSignedFileUrl,
  reportPost, getVerifiedAuthorIds,
  getWins, createWin, reportWin, uploadPostImage, uploadPostVideo,
} from '@/lib/supabase'
import type { ReactionType } from '@/lib/types'
import { MILESTONE_TYPES, MILESTONE_BY_KEY, STICKER_OPTIONS, type MilestoneType } from '@/lib/feedConstants'
import {
  X, MoreHorizontal, EyeOff, Check, Camera, BadgeCheck, Plus,
} from 'lucide-react'

// Max length for a win's own video, in seconds -- "as a win maximum is
// 20 sec", Instagram-Story-like (photo or video, author's choice).
const WIN_VIDEO_MAX_SECONDS = 20

// Build Spec: The Feed (Wins strip, milestone posts) v2.0, 2 September
// 2026, since revised -- a Wins strip of expiring achievement stories
// on top (now photo OR short video, Insta-story-style) and edge-to-
// edge post cards underneath. Posting is camera-first again (see
// PostComposer): photo only, no video on regular posts, author picks
// two stickers as that post's reaction options. Reporting is
// unchanged -- same report -> auto-hide -> human-review flow as
// before. Visibility is no longer org-scoped -- "everyone can see it,
// don't limit it" -- getFeed/getWins return everything RLS allows any
// signed-in viewer to see, across organisations.
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
function firstName(name?: string) {
  return name?.split(' ')[0] || 'Someone'
}

export default function FeedPanel() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<any[]>([])
  const [verifiedAuthors, setVerifiedAuthors] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  // No longer means "can't see the real feed" -- everyone sees the
  // same feed now. Still means "can't post yet" -- posting requires an
  // organisation (RLS: author insert own org).
  const exploring = !user?.organisation_id

  const load = () => {
    getFeed().then(({ data }) => {
      const rows = data || []
      setPosts(rows)
      setLoading(false)
      const authorIds = Array.from(new Set(rows.map((p: any) => p.author_id).filter(Boolean)))
      if (authorIds.length) getVerifiedAuthorIds(authorIds).then(({ data: ids }) => setVerifiedAuthors(new Set(ids)))
    })
  }
  useEffect(load, [])

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-4">
        {[0, 1].map(i => <div key={i} className="h-[220px] rounded-[14px] bg-[var(--app-surface)] animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="pb-2">
      {user?.organisation_id && <WinsStrip userId={user.id} organisationId={user.organisation_id} />}

      {exploring && (
        <div className="px-4 mb-4">
          <p className="text-[12.5px] text-[var(--app-text-secondary)]">
            Link to your organisation in My Work to start posting your own wins and updates.
          </p>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="flex flex-col items-center text-center py-20 px-6">
          <p className="font-semibold text-[var(--app-text)] text-[15px] mb-1">Nothing here yet</p>
          <p className="text-[13px] text-[var(--app-text-tertiary)]">Wins and updates will show up here.</p>
        </div>
      ) : (
        // Edge-to-edge, Instagram-style -- no side padding here any
        // more (each card carries its own internal padding for text,
        // but an image spans the full card width with nothing inset).
        // A thin divider between cards stands in for the old bordered/
        // floating-card look.
        <div>
          {posts.map(p => <PostCard key={p.id} post={p} verified={verifiedAuthors.has(p.author_id)} onChanged={load} />)}
        </div>
      )}
    </div>
  )
}

// ── Wins strip -- achievements only, expires like a story (see
// getWins: last 2 days, client-side window, nothing stored as an
// expiry and nothing accumulates into a permanent highlight reel). ──
function WinsStrip({ userId, organisationId }: { userId: string; organisationId: string }) {
  const { user } = useAuth()
  const [wins, setWins] = useState<any[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [viewing, setViewing] = useState<any | null>(null)

  const load = () => { getWins().then(({ data }) => setWins(data || [])) }
  useEffect(load, [])

  return (
    <div className="pt-3 pb-1">
      <div className="flex gap-3.5 overflow-x-auto px-4 pb-0.5" style={{ scrollbarWidth: 'none' }}>
        <button onClick={() => setAddOpen(true)} className="flex flex-col items-center gap-1.5 flex-shrink-0" style={{ width: 60 }}>
          <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 54, height: 54, border: '3px solid #F26B21' }}>
            <span className="w-full h-full rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--app-overlay-2)' }}>
              <Plus className="w-5 h-5" style={{ color: '#F26B21' }} />
            </span>
          </span>
          <span className="text-[11px] truncate w-full text-center" style={{ color: '#5A5A5A' }}>Add win</span>
        </button>

        {wins.map(w => {
          const meta = MILESTONE_BY_KEY[w.milestone_type as MilestoneType]
          return (
            <button key={w.id} onClick={() => setViewing(w)} className="flex flex-col items-center gap-1.5 flex-shrink-0" style={{ width: 60 }}>
              <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 54, height: 54, border: `3px solid ${meta?.ring || '#0F6E56'}` }}>
                <span className="w-full h-full rounded-full flex items-center justify-center text-[13px] font-semibold" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
                  {initials(w.author?.full_name)}
                </span>
              </span>
              <span className="text-[11px] truncate w-full text-center" style={{ color: '#5A5A5A' }}>{firstName(w.author?.full_name)}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3.5 px-4 mt-2.5 mb-1">
        <Legend color="#0F6E56" label="Verified" />
        <Legend color="#E0A94B" label="Interview" />
        <Legend color="#F26B21" label="New job" />
      </div>

      {addOpen && (
        <AddWinSheet
          userId={userId} organisationId={organisationId}
          onClose={() => setAddOpen(false)}
          onAdded={() => { setAddOpen(false); load() }}
        />
      )}
      {viewing && (
        <WinViewer
          win={viewing} isOwn={viewing.author_id === user?.id} organisationId={organisationId} userId={userId}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#8A8A8A' }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} /> {label}
    </span>
  )
}

// "Tapping Add win opens a simple sheet: pick a milestone type, then
// add a short line (5 seconds, like a quick story)."
function AddWinSheet({ userId, organisationId, onClose, onAdded }: {
  userId: string; organisationId: string; onClose: () => void; onAdded: () => void
}) {
  const [type, setType] = useState<MilestoneType | null>(null)
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isVideo, setIsVideo] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mediaError, setMediaError] = useState('')
  const [posting, setPosting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Insta-story-style: photo or a short video, author's choice. Video
  // is capped at 20 seconds -- checked client-side by loading it into
  // an off-screen <video> and reading its real duration before it's
  // ever accepted, not just relying on a picker limit that isn't
  // enforceable anyway.
  const pickMedia = (f: File | null) => {
    if (!f) return
    setMediaError('')
    const video = f.type.startsWith('video/')
    if (!video) {
      setFile(f); setIsVideo(false); setPreviewUrl(URL.createObjectURL(f))
      return
    }
    const url = URL.createObjectURL(f)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      if (probe.duration > WIN_VIDEO_MAX_SECONDS) {
        setMediaError(`Videos for a win can be up to ${WIN_VIDEO_MAX_SECONDS} seconds — this one's ${Math.round(probe.duration)}s.`)
        URL.revokeObjectURL(url)
        return
      }
      setFile(f); setIsVideo(true); setPreviewUrl(url)
    }
    probe.src = url
  }

  const submit = async () => {
    if (!type) return
    setPosting(true)
    let image_path: string | undefined
    let video_path: string | undefined
    if (file && isVideo) {
      const { path } = await uploadPostVideo(userId, file, file.name.split('.').pop() || 'mp4')
      video_path = path || undefined
    } else if (file) {
      const { path } = await uploadPostImage(userId, file)
      image_path = path || undefined
    }
    await createWin(userId, organisationId, { milestone_type: type, content: content.trim() || undefined, image_path, video_path })
    setPosting(false)
    onAdded()
  }

  // Portaled to document.body -- rendered from inside FeedPanel, which
  // is nested inside main (a scrolling container). fixed positioning
  // is supposed to escape that regardless of nesting, but a full-
  // screen modal several levels deep inside a scrolling ancestor is
  // exactly the kind of thing mobile WebKit/webview builds render
  // inconsistently in practice -- "the bottom nav comes up over it"
  // matches the same class of bug PostComposer already hit once
  // (see StudentLayoutClient's own comment on why it moved to a true
  // top-level sibling). Portaling escapes it structurally instead of
  // relying on z-index alone.
  return createPortal((
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl px-5 pt-5 pb-6"
        style={{ backgroundColor: 'var(--app-surface)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        {!type ? (
          <>
            <p className="text-[16px] font-bold text-[var(--app-text)] mb-4">Add a win</p>
            <div className="space-y-2">
              {MILESTONE_TYPES.map(m => (
                <button
                  key={m.key} onClick={() => setType(m.key)}
                  className="w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.ring }} />
                  <span className="text-[13.5px] text-[var(--app-text)]">{m.sheetLabel}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setType(null)} className="text-[13px] font-semibold mb-3" style={{ color: 'var(--app-text-secondary)' }}>← Change type</button>
            <p className="text-[15px] font-bold text-[var(--app-text)] mb-3">{MILESTONE_BY_KEY[type].sheetLabel}</p>
            <textarea
              value={content} onChange={e => setContent(e.target.value)}
              placeholder="Add a short line (optional)" rows={2}
              className="w-full bg-[var(--app-overlay-2)] border rounded-xl px-3.5 py-2.5 text-[13px] text-[var(--app-text)] placeholder:text-[var(--app-text-tertiary)] outline-none resize-none mb-3"
              style={{ borderColor: 'var(--app-border)' }}
            />
            {previewUrl && (
              isVideo
                ? <video src={previewUrl} className="w-full h-32 object-cover rounded-lg mb-3" muted autoPlay loop playsInline />
                : <img src={previewUrl} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />
            )}
            {mediaError && <p className="text-[12px] text-danger-text mb-3">{mediaError}</p>}
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-[13px] font-semibold mb-4" style={{ color: '#F26B21' }}>
              <Camera className="w-4 h-4" /> {file ? `Change ${isVideo ? 'video' : 'photo'}` : `Add a photo or video, up to ${WIN_VIDEO_MAX_SECONDS}s (optional)`}
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => pickMedia(e.target.files?.[0] || null)} />
            <button
              onClick={submit} disabled={posting}
              className="w-full text-white font-semibold text-[14px] py-3 rounded-xl disabled:opacity-50 transition"
              style={{ backgroundColor: '#F26B21' }}
            >
              {posting ? 'Sharing…' : 'Share win'}
            </button>
          </>
        )}
      </div>
    </div>
  ), document.body)
}

// A win's own short card, full-screen, tap to close -- a story, not a
// permanent post. No reactions here (that's the post card's thing);
// still reportable, same as everything else on the feed.
function WinViewer({ win, isOwn, organisationId, userId, onClose }: {
  win: any; isOwn: boolean; organisationId: string; userId: string; onClose: () => void
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const meta = MILESTONE_BY_KEY[win.milestone_type as MilestoneType]

  useEffect(() => {
    if (win.video_path) getSignedFileUrl('post-videos', win.video_path).then(({ url }) => setMediaUrl(url))
    else if (win.image_path) getSignedFileUrl('post-images', win.image_path).then(({ url }) => setMediaUrl(url))
  }, [win.image_path, win.video_path])

  // Real Instagram-Story shape now: the photo/video is the full-bleed
  // background, not a small rounded thumbnail sitting under the text
  // ("show the full picture or video" -- it was capped at 280px tall
  // with padding around it, which is what made it look small
  // regardless of the source image's own size). A text-only win (no
  // media at all) still gets the milestone-colour gradient as its
  // background, same as before.
  return createPortal((
    <div className="fixed inset-0 z-50 bg-black" onClick={onClose}>
      {mediaUrl ? (
        win.video_path
          ? <video src={mediaUrl} className="absolute inset-0 w-full h-full object-cover" autoPlay loop muted playsInline />
          : <img src={mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${meta?.ring || '#0F6E56'}, #1A1613)` }} />
      )}

      {/* Top scrim + controls -- name/pill readable over any media,
          bright or dark. */}
      <div
        className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-4 pb-10"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 text-white min-w-0">
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            {initials(win.author?.full_name)}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-[14px] truncate">{win.author?.full_name}</p>
            <span className="inline-block text-[11px] font-semibold px-2.5 py-[3px] rounded-full mt-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}>{meta?.pillLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isOwn && (
            <button onClick={() => setReportOpen(true)} aria-label="Report this win" className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center text-white">
              <MoreHorizontal className="w-[18px] h-[18px]" />
            </button>
          )}
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {win.content && (
        <div
          className="absolute inset-x-0 bottom-0 px-6 pt-16 text-white text-center"
          style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}
          onClick={e => e.stopPropagation()}
        >
          <p className="text-[17px] leading-snug">{win.content}</p>
        </div>
      )}

      {reportOpen && (
        <div onClick={e => e.stopPropagation()}>
          <ReportSheet
            onClose={() => setReportOpen(false)}
            onSent={() => { setReportOpen(false); onClose() }}
            onSend={(reasonKey, note) => reportWin(win.id, organisationId, userId, reasonKey, note)}
          />
        </div>
      )}
    </div>
  ), document.body)
}

function PostCard({ post, verified, onChanged }: { post: any; verified: boolean; onChanged: () => void }) {
  const { user } = useAuth()
  const router = useRouter()
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const reactions: any[] = post.post_reactions || []
  const myReaction = reactions.find(r => r.user_id === user?.id)?.reaction as ReactionType | undefined
  const meta = post.milestone_type ? MILESTONE_BY_KEY[post.milestone_type as MilestoneType] : null
  // Reverted from the milestone-driven set back to the old author-
  // picked model: whatever two stickers the author chose in the
  // composer are this post's own reaction options. Any post with none
  // set (old milestone-tagged rows, mainly) falls back to the first
  // two stickers rather than showing nothing.
  const choiceKeys: string[] = post.sticker_choices?.length ? post.sticker_choices : STICKER_OPTIONS.slice(0, 2).map(s => s.key)
  const options = choiceKeys.map(k => STICKER_OPTIONS.find(s => s.key === k)).filter(Boolean) as typeof STICKER_OPTIONS

  useEffect(() => {
    if (post.image_path) getSignedFileUrl('post-images', post.image_path).then(({ url }) => setMediaUrl(url))
  }, [post.image_path])

  const react = async (key: string) => {
    if (!user) return
    await setPostReaction(post.id, user.id, myReaction === key ? null : (key as ReactionType))
    onChanged()
  }

  // Auto-hide is instant and protective, but it is NEVER a decision
  // against the person who posted -- neutral wording, shown to
  // whoever can still see the row at all (the author, or org staff --
  // RLS keeps it from reaching anyone else).
  if (post.hidden) {
    return (
      <div
        className="px-4 py-6 flex flex-col items-center text-center gap-2 border-b"
        style={{ borderColor: 'var(--app-border)' }}
      >
        <EyeOff className="w-5 h-5" style={{ color: 'var(--app-text-tertiary)' }} />
        <p className="text-[13px] font-semibold text-[var(--app-text)]">This post has been hidden while it is checked by a person.</p>
        <p className="text-[12px]" style={{ color: 'var(--app-text-tertiary)' }}>Hidden automatically after being reported. Nothing has been decided yet.</p>
      </div>
    )
  }

  // Edge-to-edge, Instagram-style: an image spans the full card width
  // with nothing inset around it (no rounded corners, no border) --
  // only the header and text keep their own internal padding for
  // readability. A text-only post (no image) reads LinkedIn-style: no
  // photo block at all, just a clean padded card. A thin bottom border
  // stands in for what used to be a floating bordered/rounded card,
  // matching how Instagram separates posts in one continuous feed.
  return (
    <div className="border-b" style={{ borderColor: 'var(--app-border)' }}>
      {meta && <div className="h-[4px]" style={{ background: 'linear-gradient(to right, #F26B21, #E0A94B)' }} />}

      <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2.5">
        <button
          onClick={() => router.push(post.author_id === user?.id ? '/student/profile' : `/student/profile/${post.author_id}`)}
          className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
            {initials(post.author_name)}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[13px] font-semibold text-[var(--app-text)] truncate">
              {post.author_name}
              {verified && <BadgeCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#0F6E56' }} />}
            </p>
            <p className="text-[11px]" style={{ color: '#5A5A5A' }}>{timeAgo(post.created_at)}</p>
          </div>
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {meta && (
            <span className="text-[11px] font-semibold px-[10px] py-[3px] rounded-full whitespace-nowrap" style={{ backgroundColor: meta.pillBg, color: meta.pillText }}>
              {meta.pillLabel}
            </span>
          )}
          {post.author_id !== user?.id && (
            <button onClick={() => setReportOpen(true)} aria-label="Report this post" className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--app-overlay-1)] transition">
              <MoreHorizontal className="w-4 h-4" style={{ color: 'var(--app-text-tertiary)' }} />
            </button>
          )}
        </div>
      </div>

      {(post.title || post.content) && (
        <div className="px-4 pb-3">
          {post.title && <p className="text-[14px] font-semibold text-[var(--app-text)] leading-[1.55] mb-0.5">{post.title}</p>}
          {post.content && <p className="text-[14px] text-[var(--app-text-body)] leading-[1.55]">{post.content}</p>}
        </div>
      )}

      {/* Fixed height so the card never enlarges to fit a tall source
          image -- edge-to-edge width, but not edge-to-edge height. */}
      {post.image_path && (
        <div className="relative w-full bg-[var(--app-surface-2)]" style={{ height: 300 }}>
          {!mediaUrl && <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: 'var(--app-surface-2)' }} />}
          {mediaUrl && <img src={mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-4 py-3.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {options.map(r => (
            <button
              key={r.key} onClick={() => react(r.key)} title={r.label}
              className="flex items-center gap-1.5 rounded-full border transition"
              style={{
                borderColor: myReaction === r.key ? '#F26B21' : '#E7E4DE',
                backgroundColor: myReaction === r.key ? 'rgba(242,107,33,0.1)' : '#F7F5F0',
                padding: '6px 12px',
              }}
            >
              <span className="text-[13px] leading-none">{r.emoji}</span>
              <span className="text-[12px] font-medium leading-none" style={{ color: myReaction === r.key ? '#F26B21' : '#5A5A5A' }}>{r.label}</span>
            </button>
          ))}
        </div>
        {reactions.length > 0 && <span className="text-[12px] flex-shrink-0" style={{ color: '#5A5A5A' }}>{reactions.length}</span>}
      </div>

      {reportOpen && (
        <ReportSheet
          onClose={() => setReportOpen(false)}
          onSent={() => { setReportOpen(false); onChanged() }}
          onSend={(reasonKey, note) => reportPost(post.id, post.organisation_id, user!.id, reasonKey, note)}
        />
      )}
    </div>
  )
}

// Stage 1 of report -> auto-hide -> human review. Plain, single-choice
// reasons a young person can understand, an optional note, and a
// quiet safety line. Shared by posts and wins -- only the onSend
// callback differs.
function ReportSheet({ onClose, onSend, onSent }: {
  onClose: () => void
  onSend: (reasonKey: string, note: string) => Promise<{ error: any }>
  onSent: () => void
}) {
  const REPORT_REASONS = [
    { key: 'bullying', label: 'It is bullying or unkind' },
    { key: 'inappropriate', label: 'It is inappropriate or upsetting' },
    { key: 'not_real', label: 'It is not real, or not their work' },
    { key: 'other', label: 'Something else' },
  ]
  const [reasonKey, setReasonKey] = useState<string>(REPORT_REASONS[0].key)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    setSending(true); setError('')
    const { error: err } = await onSend(reasonKey, note)
    setSending(false)
    if (err) return setError("Couldn't send that -- try again.")
    onSent()
  }

  return createPortal((
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl px-5 pt-5 pb-6"
        style={{ backgroundColor: 'var(--app-surface)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[16px] font-bold text-[var(--app-text)] mb-1">Report this post</p>
        <p className="text-[13px] mb-4" style={{ color: 'var(--app-text-secondary)' }}>Tell us what is wrong. A person will look at it.</p>

        <div className="space-y-2 mb-4">
          {REPORT_REASONS.map(r => (
            <button
              key={r.key} onClick={() => setReasonKey(r.key)}
              className="w-full flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition"
              style={{ borderColor: reasonKey === r.key ? '#F26B21' : 'var(--app-border)', backgroundColor: reasonKey === r.key ? 'rgba(242,107,33,0.08)' : 'transparent' }}
            >
              <span className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center" style={{ borderColor: reasonKey === r.key ? '#F26B21' : 'var(--app-border)' }}>
                {reasonKey === r.key && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F26B21' }} />}
              </span>
              <span className="text-[13.5px] text-[var(--app-text)]">{r.label}</span>
            </button>
          ))}
        </div>

        <textarea
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="Add anything that helps (optional)"
          rows={2}
          className="w-full bg-[var(--app-overlay-2)] border border-[var(--app-border)] rounded-xl px-3.5 py-2.5 text-[13px] text-[var(--app-text)] placeholder:text-[var(--app-text-tertiary)] outline-none resize-none mb-4"
        />

        {error && <p className="text-[12.5px] text-danger-text mb-3">{error}</p>}

        <button
          onClick={send} disabled={sending}
          className="w-full flex items-center justify-center gap-1.5 bg-brand text-white font-semibold text-[14px] py-3 rounded-xl disabled:opacity-50 transition mb-3"
        >
          {sending ? 'Sending…' : <><Check className="w-4 h-4" /> Send report</>}
        </button>

        <p className="text-center text-[11.5px]" style={{ color: 'var(--app-text-tertiary)' }}>
          If you are in danger, tell a trusted adult or call emergency services.
        </p>
      </div>
    </div>
  ), document.body)
}
