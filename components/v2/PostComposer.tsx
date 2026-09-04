'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/AuthContext'
import { createPost, uploadPostImage } from '@/lib/supabase'
import { STICKER_OPTIONS } from '@/lib/feedConstants'
import { X, Check, RotateCcw, Image as ImageIcon, Globe, Users } from 'lucide-react'

// Reverted per direct request: "bring back the old feature but to
// post picture only, no video, and writing a comment -- bring back
// the whole front and back, the choosing two stickers." This restores
// the camera-first capture flow (front/back camera, take a photo or
// pick one from the gallery) and the old author-picked 2-sticker
// reaction model -- with NO video capability on regular posts, unlike
// the old pre-v2.0 version this is modelled on. Milestone tagging is
// gone from this screen entirely; milestones are a Wins-only concept
// now (see AddWinSheet in FeedPanel), reached via the strip's own
// small orange "+", not this one.
type Step = 'camera' | 'compose'

export default function PostComposer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('camera')
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [streamError, setStreamError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [stickers, setStickers] = useState<string[]>([])
  const [visibility, setVisibility] = useState<'organisation' | 'public'>('organisation')
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isAdult = user?.date_of_birth
    ? (Date.now() - new Date(user.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25) >= 18
    : false
  // Org accounts (institution/provider/employer staff) aren't age-
  // gated the way a student is -- they're professional accounts by
  // definition, so the public/organisation-only choice is always
  // theirs to make, same as an 18+ student gets.
  const canChooseVisibility = isAdult || (!!user?.role && user.role !== 'student')

  // Camera stream only runs while the camera step is actually showing,
  // and is torn down the moment it isn't (step change, flip, unmount)
  // -- getUserMedia streams don't stop themselves.
  useEffect(() => {
    if (step !== 'camera') return
    let cancelled = false
    setStreamError('')
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setStreamError("Can't access the camera on this device — choose a photo from your gallery instead."))
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [step, facing])

  const capture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Mirror the selfie so the saved photo matches what was on screen,
    // not the raw (un-mirrored) camera feed.
    if (facing === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      if (!blob) return
      const f = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' })
      setFile(f)
      setPreviewUrl(URL.createObjectURL(f))
      setStep('compose')
    }, 'image/jpeg', 0.92)
  }

  const pickFromGallery = (f: File | null) => {
    if (!f) return
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setStep('compose')
  }

  const retake = () => {
    setFile(null)
    setPreviewUrl(null)
    setStep('camera')
  }

  // Pick exactly two -- tapping a third swaps out the oldest choice
  // rather than refusing the tap outright.
  const toggleSticker = (key: string) => {
    setStickers(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      if (prev.length >= 2) return [prev[1], key]
      return [...prev, key]
    })
  }

  const handlePost = async () => {
    if (!user?.organisation_id) return setError("You need to join an organisation before posting — enter your join code in My Work.")
    if (!file) return setError('Take or choose a photo first.')
    setPosting(true)
    setError('')
    const { path, error: upErr } = await uploadPostImage(user.id, file)
    if (upErr || !path) { setPosting(false); setError(upErr?.message || 'Photo upload failed.'); return }
    const { error: postErr } = await createPost(user.organisation_id, user.id, {
      content: caption.trim() || undefined,
      image_path: path,
      visibility,
      sticker_choices: stickers.length ? stickers : undefined,
    })
    setPosting(false)
    if (postErr) { setError(postErr.message); return }
    onPosted()
  }

  if (step === 'camera') {
    return createPortal((
      <div className="fixed inset-0 z-[60] flex flex-col bg-black" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-between p-4 flex-shrink-0">
          <button onClick={onClose} aria-label="Cancel" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white">
            <X className="w-5 h-5" />
          </button>
          <p className="text-white font-semibold text-[14px]">New post</p>
          <button onClick={() => setFacing(f => f === 'user' ? 'environment' : 'user')} aria-label="Flip camera" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white">
            <RotateCcw className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
          {streamError ? (
            <p className="text-white/70 text-[13px] text-center px-8">{streamError}</p>
          ) : (
            <video
              ref={videoRef} autoPlay playsInline muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="flex items-center justify-center gap-10 p-6 flex-shrink-0">
          <button onClick={() => fileRef.current?.click()} aria-label="Choose from gallery" className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center text-white">
            <ImageIcon className="w-5 h-5" />
          </button>
          <button
            onClick={capture} disabled={!!streamError} aria-label="Take photo"
            className="w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition disabled:opacity-40"
          >
            <span className="w-[58px] h-[58px] rounded-full bg-white" />
          </button>
          <span className="w-11 h-11" />
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pickFromGallery(e.target.files?.[0] || null)} />
      </div>
    ), document.body)
  }

  return createPortal((
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: 'var(--app-bg)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-between p-4 flex-shrink-0">
        <button onClick={retake} className="text-[var(--app-text)] font-semibold text-[14px]">← Retake</button>
        <p className="text-[var(--app-text)] font-semibold text-[14px]">New post</p>
        <button onClick={handlePost} disabled={posting} className="text-brand font-semibold text-[14px] disabled:opacity-40">
          {posting ? 'Posting…' : 'Post'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
        {error && <p className="text-[13px] text-danger-text bg-danger-bg border border-danger-hover rounded-lg px-3.5 py-2.5">{error}</p>}

        {previewUrl && (
          <div className="relative rounded-xl overflow-hidden" style={{ height: 260 }}>
            <img src={previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        )}

        <textarea
          value={caption} onChange={e => setCaption(e.target.value)} autoFocus
          placeholder="Write a comment…"
          rows={3}
          className="w-full bg-[var(--app-overlay-2)] border border-[var(--app-border)] rounded-xl px-4 py-3 text-[15px] text-[var(--app-text)] placeholder:text-[var(--app-text-tertiary)] outline-none resize-none"
        />

        <div>
          <p className="text-[12.5px] font-semibold mb-2" style={{ color: 'var(--app-text-secondary)' }}>Choose 2 stickers</p>
          <div className="flex flex-wrap gap-2">
            {STICKER_OPTIONS.map(s => {
              const active = stickers.includes(s.key)
              return (
                <button
                  key={s.key} onClick={() => toggleSticker(s.key)}
                  className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition"
                  style={{ borderColor: active ? '#F26B21' : 'var(--app-border)', backgroundColor: active ? 'rgba(242,107,33,0.1)' : 'var(--app-overlay-2)', color: active ? '#F26B21' : 'var(--app-text-secondary)' }}
                >
                  <span className="text-[14px] leading-none">{s.emoji}</span> {s.label}
                </button>
              )
            })}
          </div>
        </div>

        {canChooseVisibility && (
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
          onClick={handlePost} disabled={posting || !file}
          className="w-full flex items-center justify-center gap-1.5 bg-brand text-white font-semibold text-[14px] py-3.5 rounded-2xl disabled:opacity-40 transition"
        >
          {posting ? 'Posting…' : <><Check className="w-4 h-4" /> Post</>}
        </button>
      </div>
    </div>
  ), document.body)
}
