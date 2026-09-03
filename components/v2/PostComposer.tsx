'use client'

import { useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createPost, uploadPostImage } from '@/lib/supabase'
import { MILESTONE_TYPES, type MilestoneType } from '@/lib/feedConstants'
import { X, Check, Camera, Globe, Users } from 'lucide-react'

// Build Spec: The Feed (Wins strip, milestone posts) v2.0 -- "Tapping
// it opens the post composer: text, with an optional picture." This
// replaces the old camera-first capture flow (photo/video toggle,
// recording, trimming) entirely -- "no video anywhere in the feed" is
// explicit and repeated throughout the new spec, and the new composer
// itself is specified as this simple. A native file input with
// capture="environment" opens the phone's own camera OR gallery
// (browser's choice, not ours to build), which is all "optionally
// with a picture" actually needs.
//
// Reactions are no longer author-picked here either -- the new spec
// derives the reaction set from the post's milestone_type
// (REACTIONS_BY_MILESTONE), so the old 2-of-4 sticker picker is gone;
// this screen picks the milestone tag itself instead (optional -- a
// plain update with no tag is still a normal post).
export default function PostComposer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const { user } = useAuth()
  const [milestone, setMilestone] = useState<MilestoneType | null>(null)
  const [caption, setCaption] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<'organisation' | 'public'>('organisation')
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const isAdult = user?.date_of_birth
    ? (Date.now() - new Date(user.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25) >= 18
    : false

  const pickPhoto = (f: File | null) => {
    if (!f) return
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  const handlePost = async () => {
    if (!user?.organisation_id) return setError("You need to join an organisation before posting — enter your join code in My Work.")
    if (!caption.trim() && !file) return setError('Write something, or attach a photo.')
    setPosting(true)
    setError('')
    let image_path: string | undefined
    if (file) {
      const { path, error: upErr } = await uploadPostImage(user.id, file)
      if (upErr || !path) { setPosting(false); setError(upErr?.message || 'Photo upload failed.'); return }
      image_path = path
    }
    const { error: postErr } = await createPost(user.organisation_id, user.id, {
      content: caption.trim() || undefined, image_path, visibility, milestone_type: milestone,
    })
    setPosting(false)
    if (postErr) { setError(postErr.message); return }
    onPosted()
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: 'var(--app-bg)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-between p-4 flex-shrink-0">
        <button onClick={onClose} className="text-[var(--app-text)] font-semibold text-[14px]">Cancel</button>
        <p className="text-[var(--app-text)] font-semibold text-[14px]">New post</p>
        <button onClick={handlePost} disabled={posting || (!caption.trim() && !file)} className="text-brand font-semibold text-[14px] disabled:opacity-40">
          {posting ? 'Posting…' : 'Post'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
        {error && <p className="text-[13px] text-danger-text bg-danger-bg border border-danger-hover rounded-lg px-3.5 py-2.5">{error}</p>}

        <textarea
          value={caption} onChange={e => setCaption(e.target.value)} autoFocus
          placeholder="Share a win or an update…"
          rows={4}
          className="w-full bg-[var(--app-overlay-2)] border border-[var(--app-border)] rounded-xl px-4 py-3 text-[15px] text-[var(--app-text)] placeholder:text-[var(--app-text-tertiary)] outline-none resize-none"
        />

        {previewUrl ? (
          <div className="relative rounded-xl overflow-hidden" style={{ height: 210 }}>
            <img src={previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <button
              onClick={() => { setFile(null); setPreviewUrl(null) }} aria-label="Remove photo"
              className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-1.5 text-[13px] font-semibold py-3.5 rounded-xl border"
            style={{ color: '#F26B21', borderColor: 'var(--app-border)' }}
          >
            <Camera className="w-4 h-4" /> Add a photo (optional)
          </button>
        )}
        {/* No capture attribute forced to a single mode -- leaving it
            unset lets the phone offer its own camera-or-gallery choice
            rather than us reimplementing either. */}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pickPhoto(e.target.files?.[0] || null)} />

        <div>
          <p className="text-[12.5px] font-semibold mb-2" style={{ color: 'var(--app-text-secondary)' }}>Is this a milestone? (optional)</p>
          <div className="flex flex-wrap gap-2">
            {MILESTONE_TYPES.map(m => {
              const active = milestone === m.key
              return (
                <button
                  key={m.key} onClick={() => setMilestone(active ? null : m.key)}
                  className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition"
                  style={{ borderColor: active ? m.ring : 'var(--app-border)', backgroundColor: active ? `${m.ring}20` : 'var(--app-overlay-2)', color: active ? m.ring : 'var(--app-text-secondary)' }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.ring }} />
                  {m.pillLabel}
                </button>
              )
            })}
          </div>
        </div>

        {isAdult && (
          <button
            onClick={() => setVisibility(v => v === 'organisation' ? 'public' : 'organisation')}
            className="flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-2 rounded-lg border"
            style={{ color: 'var(--app-text-secondary)', backgroundColor: 'var(--app-overlay-2)', borderColor: 'var(--app-border)' }}
          >
            {visibility === 'public' ? <Globe className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
            {visibility === 'public' ? 'Public — anyone on LERN' : 'Organisation only'}
          </button>
        )}
      </div>

      <div className="p-5 flex-shrink-0">
        <button
          onClick={handlePost} disabled={posting || (!caption.trim() && !file)}
          className="w-full flex items-center justify-center gap-1.5 bg-brand text-white font-semibold text-[14px] py-3.5 rounded-2xl disabled:opacity-40 transition"
        >
          {posting ? 'Posting…' : <><Check className="w-4 h-4" /> Post</>}
        </button>
      </div>
    </div>
  )
}
