'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getFeed, getPublicFeed, setPostReaction, getSignedFileUrl,
  reportPost, getVerifiedAuthorIds,
  getWins, createWin, reportWin, uploadPostImage,
} from '@/lib/supabase'
import type { ReactionType } from '@/lib/types'
import { MILESTONE_TYPES, MILESTONE_BY_KEY, REACTIONS_BY_MILESTONE, type MilestoneType } from '@/lib/feedConstants'
import PostComposer from '@/components/v2/PostComposer'
import {
  X, MoreHorizontal, EyeOff, Check, Camera, BadgeCheck, Plus,
} from 'lucide-react'

// Build Spec: The Feed (Wins strip, milestone posts) v2.0, 2 September
// 2026 -- supersedes the earlier LinkedIn-style layout entirely.
// Achievement, not entertainment: text-and-picture posts only (no
// video anywhere -- the old tap-to-open video player and camera/
// record composer are gone on purpose, not an oversight), reactions
// instead of open comments, and a Wins strip of expiring achievement
// stories on top. Reporting is unchanged -- same report -> auto-hide
// -> human-review flow as before, just carried over onto the new
// card shape.
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
  const [composerOpen, setComposerOpen] = useState(false)
  const exploring = !user?.organisation_id

  const load = () => {
    (exploring ? getPublicFeed() : getFeed(user!.organisation_id!)).then(({ data }) => {
      const rows = data || []
      setPosts(rows)
      setLoading(false)
      const authorIds = Array.from(new Set(rows.map((p: any) => p.author_id).filter(Boolean)))
      if (authorIds.length) getVerifiedAuthorIds(authorIds).then(({ data: ids }) => setVerifiedAuthors(new Set(ids)))
    })
  }
  useEffect(load, [user?.organisation_id])

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

      {user?.organisation_id && (
        <div className="px-4 mb-4">
          <button
            onClick={() => setComposerOpen(true)}
            className="w-full flex items-center gap-3 rounded-[14px] border px-[14px] py-3 transition"
            style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
          >
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
              {initials(user?.full_name)}
            </span>
            <span className="flex-1 text-left text-[13.5px]" style={{ color: '#8A8A8A' }}>Share a win or an update…</span>
            <Camera className="w-[18px] h-[18px] flex-shrink-0" style={{ color: '#F26B21' }} />
          </button>
        </div>
      )}

      {exploring && (
        <div className="px-4 mb-4">
          <p className="text-[12.5px] text-[var(--app-text-secondary)]">
            You're seeing public educational content only — link to your organisation in My Work to see everything.
          </p>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="flex flex-col items-center text-center py-20 px-6">
          <p className="font-semibold text-[var(--app-text)] text-[15px] mb-1">Nothing here yet</p>
          <p className="text-[13px] text-[var(--app-text-tertiary)]">
            {exploring ? 'Public educational content will show up here.' : "Your organisation's milestones will show up here."}
          </p>
        </div>
      ) : (
        <div className="px-4 space-y-4">
          {posts.map(p => <PostCard key={p.id} post={p} verified={verifiedAuthors.has(p.author_id)} onChanged={load} />)}
        </div>
      )}

      {composerOpen && (
        <PostComposer onClose={() => setComposerOpen(false)} onPosted={() => { setComposerOpen(false); load() }} />
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

  const load = () => { getWins(organisationId).then(({ data }) => setWins(data || [])) }
  useEffect(load, [organisationId])

  return (
    <div className="pt-3 pb-1">
      <p className="text-[12px] font-semibold px-4 mb-2.5" style={{ color: '#5A5A5A', letterSpacing: '0.04em' }}>WINS THIS WEEK</p>
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (!type) return
    setPosting(true)
    let image_path: string | undefined
    if (file) {
      const { path } = await uploadPostImage(userId, file)
      image_path = path || undefined
    }
    await createWin(userId, organisationId, { milestone_type: type, content: content.trim() || undefined, image_path })
    setPosting(false)
    onAdded()
  }

  return (
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
            {previewUrl && <img src={previewUrl} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />}
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-[13px] font-semibold mb-4" style={{ color: '#F26B21' }}>
              <Camera className="w-4 h-4" /> {file ? 'Change photo' : 'Add a photo (optional)'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0]
              if (f) { setFile(f); setPreviewUrl(URL.createObjectURL(f)) }
            }} />
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
  )
}

// A win's own short card, full-screen, tap to close -- a story, not a
// permanent post. No reactions here (that's the post card's thing);
// still reportable, same as everything else on the feed.
function WinViewer({ win, isOwn, organisationId, userId, onClose }: {
  win: any; isOwn: boolean; organisationId: string; userId: string; onClose: () => void
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const meta = MILESTONE_BY_KEY[win.milestone_type as MilestoneType]

  useEffect(() => {
    if (win.image_path) getSignedFileUrl('post-images', win.image_path).then(({ url }) => setImgUrl(url))
  }, [win.image_path])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: `linear-gradient(160deg, ${meta?.ring || '#0F6E56'}, #1A1613)`, paddingTop: 'env(safe-area-inset-top)' }}
      onClick={onClose}
    >
      <div className="flex items-center justify-end gap-1 px-4 flex-shrink-0" style={{ paddingTop: '1rem' }}>
        {!isOwn && (
          <button onClick={e => { e.stopPropagation(); setReportOpen(true) }} aria-label="Report this win" className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center text-white">
            <MoreHorizontal className="w-[18px] h-[18px]" />
          </button>
        )}
        <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center text-white">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center text-white" onClick={e => e.stopPropagation()}>
        <span className="w-16 h-16 rounded-full flex items-center justify-center text-[20px] font-bold mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
          {initials(win.author?.full_name)}
        </span>
        <p className="font-bold text-[16px] mb-1.5">{win.author?.full_name}</p>
        <span className="text-[11.5px] font-semibold px-3 py-1 rounded-full mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>{meta?.pillLabel}</span>
        {win.content && <p className="text-[18px] leading-snug mb-5 max-w-xs">{win.content}</p>}
        {imgUrl && <img src={imgUrl} alt="" className="max-h-[280px] max-w-full rounded-2xl object-cover" />}
      </div>

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
  )
}

function PostCard({ post, verified, onChanged }: { post: any; verified: boolean; onChanged: () => void }) {
  const { user } = useAuth()
  const router = useRouter()
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const reactions: any[] = post.post_reactions || []
  const myReaction = reactions.find(r => r.user_id === user?.id)?.reaction as ReactionType | undefined
  const meta = post.milestone_type ? MILESTONE_BY_KEY[post.milestone_type as MilestoneType] : null
  const options = REACTIONS_BY_MILESTONE[post.milestone_type || 'default'] || REACTIONS_BY_MILESTONE.default

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
  // RLS keeps it from reaching anyone else). Unchanged from before;
  // only the card shape around it changed.
  if (post.hidden) {
    return (
      <div
        className="rounded-[14px] border px-4 py-6 flex flex-col items-center text-center gap-2"
        style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
      >
        <EyeOff className="w-5 h-5" style={{ color: 'var(--app-text-tertiary)' }} />
        <p className="text-[13px] font-semibold text-[var(--app-text)]">This post has been hidden while it is checked by a person.</p>
        <p className="text-[12px]" style={{ color: 'var(--app-text-tertiary)' }}>Hidden automatically after being reported. Nothing has been decided yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-[14px] border overflow-hidden" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      {meta && <div className="h-[5px]" style={{ background: 'linear-gradient(to right, #F26B21, #E0A94B)' }} />}

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

      {/* Medium, not edge-to-edge huge and not a thumbnail -- pinned to
          ~210px regardless of the source image's own aspect ratio. */}
      {post.image_path && (
        <div className="relative w-full bg-[var(--app-surface-2)]" style={{ height: 210 }}>
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

  return (
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
  )
}
