'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createPost, uploadPostImage, uploadPostVideo } from '@/lib/supabase'
import { X, RotateCcw, Timer, Video, Image as ImageIcon, Type, Circle, Square, Globe, Users, Check, Scissors } from 'lucide-react'

type Step = 'camera' | 'preview' | 'trim' | 'write' | 'details'
type CaptureMode = 'photo' | 'video'
const MAX_RECORD_SECS = 60

// The author picks exactly 2 of these -- what shows on their post in
// Feed, not a fixed global set every viewer sees on every post.
const STICKER_OPTIONS = [
  { key: 'congratulations', label: 'Celebrate', emoji: '🎉' },
  { key: 'well_done', label: 'Well done', emoji: '👏' },
  { key: 'keep_going', label: 'Keep going', emoji: '🔥' },
  { key: 'proud', label: 'Proud', emoji: '⭐' },
]

// Re-encodes [start, end] of a video into a new, genuinely shorter
// file -- not just in/out metadata, since that wouldn't actually cut
// down what gets uploaded. No video library in this project (adding
// ffmpeg.wasm is a real ~30MB dependency), so this does it with what
// the browser already has: play the source through a canvas (video)
// and the Web Audio API (audio, muted on the element itself so it's
// silent while processing), capture both into one MediaStream, and
// record that. Trimming a clip takes roughly as long as the trimmed
// clip itself, same real-time trade-off any browser-only approach has.
async function trimVideo(sourceUrl: string, start: number, end: number): Promise<Blob> {
  const video = document.createElement('video')
  video.src = sourceUrl
  video.muted = true
  video.playsInline = true
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Could not read the video'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')!
  const canvasStream = (canvas as any).captureStream(30) as MediaStream

  const audioCtx = new AudioContext()
  const source = audioCtx.createMediaElementSource(video)
  const dest = audioCtx.createMediaStreamDestination()
  source.connect(dest) // deliberately NOT connected to audioCtx.destination -- silent while processing

  const combined = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()])
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : ''
  const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

  return new Promise((resolve, reject) => {
    recorder.onstop = () => { audioCtx.close(); resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' })) }
    recorder.onerror = () => { audioCtx.close(); reject(new Error('Trim failed')) }

    let raf = 0
    const draw = () => {
      if (video.currentTime >= end || video.ended) { recorder.stop(); video.pause(); cancelAnimationFrame(raf); return }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      raf = requestAnimationFrame(draw)
    }

    video.currentTime = start
    video.onseeked = () => {
      video.onseeked = null
      recorder.start(200)
      video.play().then(() => { raf = requestAnimationFrame(draw) }).catch(reject)
    }
  })
}

// Camera-first, like the old app: opens straight to a live view (back
// camera by default), not a file picker. Photo/video toggle, flip
// front/back, an optional self-timer, a hard 60s cap on video. Gallery
// upload and a text-only post are both one tap away, never the
// default. No title/subject/description form afterward on purpose —
// just a caption — this is a feed post, not a submission.
export default function PostComposer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('camera')
  const [mode, setMode] = useState<CaptureMode>('photo')
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [timerOn, setTimerOn] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedKind, setCapturedKind] = useState<CaptureMode>('photo')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [stickers, setStickers] = useState<string[]>(['congratulations', 'well_done'])
  const [visibility, setVisibility] = useState<'organisation' | 'public'>('organisation')
  const [videoDuration, setVideoDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [trimming, setTrimming] = useState(false)
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const isAdult = user?.date_of_birth
    ? (Date.now() - new Date(user.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25) >= 18
    : false

  // ── Camera stream — one persistent stream per facing direction,
  // not per photo/video mode. Requesting audio once alongside video
  // and just not using the mic track in photo mode means toggling
  // Photo/Video doesn't tear down and re-request the whole camera
  // (which flickered and could re-trigger a permission prompt on some
  // browsers every single toggle). ──
  const startStream = async (facing: 'environment' | 'user') => {
    stopStream()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (e: any) {
      setError('Camera access denied — you can still upload from your device below.')
    }
  }
  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    if (step === 'camera') startStream(facingMode)
    return () => { if (step !== 'camera') stopStream() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, facingMode])

  useEffect(() => () => { stopStream(); if (recordTimerRef.current) clearInterval(recordTimerRef.current) }, [])

  const flipCamera = () => setFacingMode(f => f === 'environment' ? 'user' : 'environment')

  // ── Photo capture ──
  const snapPhoto = () => {
    if (!videoRef.current) return
    const v = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1) } // mirror selfies, not the back camera
    ctx.drawImage(v, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      setCapturedBlob(blob)
      setCapturedKind('photo')
      setPreviewUrl(URL.createObjectURL(blob))
      setStep('preview')
    }, 'image/jpeg', 0.92)
  }

  const capture = () => {
    if (mode === 'photo') {
      if (timerOn) {
        setCountdown(3)
        const tick = (n: number) => {
          if (n === 0) { setCountdown(null); snapPhoto(); return }
          setTimeout(() => { setCountdown(n - 1); tick(n - 1) }, 1000)
        }
        tick(3)
      } else snapPhoto()
    } else {
      recording ? stopRecording() : startRecording()
    }
  }

  // ── Video capture ──
  const startRecording = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : ''
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined)
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
      setCapturedBlob(blob)
      setCapturedKind('video')
      setPreviewUrl(URL.createObjectURL(blob))
      setStep('preview')
    }
    recorder.start(1000)
    recorderRef.current = recorder
    setRecording(true)
    setRecordSecs(0)
    recordTimerRef.current = setInterval(() => {
      setRecordSecs(s => {
        if (s + 1 >= MAX_RECORD_SECS) { stopRecording(); return MAX_RECORD_SECS }
        return s + 1
      })
    }, 1000)
  }
  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    setRecording(false)
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null }
  }

  // ── Gallery fallback ──
  const pickFromGallery = (file: File | null) => {
    if (!file) return
    setCapturedBlob(file)
    setCapturedKind(file.type.startsWith('video') ? 'video' : 'photo')
    setPreviewUrl(URL.createObjectURL(file))
    setStep('preview')
  }

  const retake = () => {
    setCapturedBlob(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setStep('camera')
  }

  const handlePost = async () => {
    if (!user?.organisation_id) return setError("You need to join an organisation before posting — enter your join code in My Work.")
    if (!caption.trim() && !capturedBlob) return setError('Write something, or attach a photo/video.')
    setPosting(true)
    setError('')
    let image_path: string | undefined
    let video_path: string | undefined
    if (capturedBlob) {
      if (capturedKind === 'photo') {
        const file = capturedBlob instanceof File ? capturedBlob : new File([capturedBlob], 'photo.jpg', { type: 'image/jpeg' })
        const { path, error: upErr } = await uploadPostImage(user.id, file)
        if (upErr || !path) { setPosting(false); setError(upErr?.message || 'Photo upload failed.'); return }
        image_path = path
      } else {
        const ext = capturedBlob instanceof File ? (capturedBlob.name.split('.').pop() || 'webm') : 'webm'
        const { path, error: upErr } = await uploadPostVideo(user.id, capturedBlob, ext)
        if (upErr || !path) { setPosting(false); setError(upErr?.message || 'Video upload failed.'); return }
        video_path = path
      }
    }
    const { error: postErr } = await createPost(user.organisation_id, user.id, { content: caption.trim() || undefined, image_path, video_path, visibility, sticker_choices: stickers })
    setPosting(false)
    if (postErr) { setError(postErr.message); return }
    onPosted()
  }

  return (
    // z-[60], above everything else in the app including the shell's
    // own z-30 nav and z-20 header with room to spare -- and paddingTop
    // safe-area-inset-top on the OUTER wrapper (every other full-screen
    // modal here does this: EditProfileScreen, the My Work detail
    // sheet) so nothing sits under the status bar. This one didn't have
    // it at all, so its own X button -- absolute top-4, no offset of
    // its own -- rendered just 16px below the true top edge of the
    // viewport, which in a standalone home-screen app is UNDER the
    // status bar overlay: present in the DOM, effectively invisible
    // and untappable. That's "I can't even see the X to cancel."
    <div className="fixed inset-0 z-[60] bg-black flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* ── CAMERA ── */}
      {step === 'camera' && (
        <div className="flex-1 flex flex-col relative">
          <video ref={videoRef} autoPlay playsInline muted className={`flex-1 w-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`} />

          <button onClick={onClose} className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center"><X className="w-5 h-5" /></button>

          {/* Vertical rail down the right edge, TikTok-style, instead of
              a horizontal row across the top. */}
          <div className="absolute top-20 right-4 z-10 flex flex-col items-center gap-4">
            <button onClick={() => setTimerOn(t => !t)} className={`w-10 h-10 rounded-full flex items-center justify-center ${timerOn ? 'bg-brand text-white' : 'bg-black/40 text-white'}`}>
              <Timer className="w-5 h-5" />
            </button>
            <button onClick={flipCamera} className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center"><RotateCcw className="w-5 h-5" /></button>
          </div>

          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-black" style={{ fontSize: '6rem' }}>{countdown || ''}</span>
            </div>
          )}
          {recording && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-1.5">
              <Circle className="w-2.5 h-2.5 fill-current text-[#FF3B30]" />
              <span className="text-white text-[13px] font-semibold">{recordSecs}s / {MAX_RECORD_SECS}s</span>
            </div>
          )}
          {error && (
            <div className="absolute top-16 left-4 right-4 bg-[#3A241C] border border-[#5A3226] rounded-lg px-3.5 py-2.5">
              <p className="text-[12.5px] text-[#FFB89E]">{error}</p>
            </div>
          )}

          <div className="flex-shrink-0 pb-8 pt-4 px-6">
            <div className="flex items-center justify-center gap-2 mb-5">
              {(['photo', 'video'] as CaptureMode[]).map(m => (
                <button
                  key={m} onClick={() => setMode(m)}
                  className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition ${mode === m ? 'bg-white text-black' : 'text-white/70'}`}
                >
                  {m === 'photo' ? 'Photo' : 'Video'}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between px-4">
              <button onClick={() => galleryRef.current?.click()} className="w-11 h-11 rounded-xl bg-white/15 text-white flex items-center justify-center">
                <ImageIcon className="w-5 h-5" />
              </button>
              <input ref={galleryRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => pickFromGallery(e.target.files?.[0] || null)} />

              <button
                onClick={capture}
                className={`w-[68px] h-[68px] rounded-full border-4 border-white flex items-center justify-center transition ${recording ? 'bg-[#FF3B30]' : 'bg-transparent'}`}
              >
                {mode === 'video' && recording
                  ? <Square className="w-6 h-6 text-white fill-current" />
                  : <div className={`w-14 h-14 rounded-full ${mode === 'video' ? 'bg-[#FF3B30]' : 'bg-white'}`} />}
              </button>

              <button onClick={() => setStep('write')} className="w-11 h-11 rounded-xl bg-white/15 text-white flex items-center justify-center">
                <Type className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {step === 'preview' && previewUrl && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center bg-black">
            {capturedKind === 'photo'
              ? <img src={previewUrl} alt="" className="max-h-full max-w-full object-contain" />
              : <video src={previewUrl} controls playsInline className="max-h-full max-w-full object-contain" />}
          </div>
          <div className="flex items-center justify-between px-6 py-5 flex-shrink-0">
            <button onClick={retake} className="text-white font-semibold text-[14px]">Retake</button>
            <button
              onClick={() => {
                if (capturedKind === 'video') { setTrimStart(0); setTrimEnd(0); setStep('trim') }
                else setStep('details')
              }}
              className="bg-white text-black font-semibold text-[14px] px-6 py-2.5 rounded-full"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── TRIM (video only) — cuts the clip down to [trimStart, trimEnd]
          before it's ever uploaded, not just an in/out marker. ── */}
      {step === 'trim' && previewUrl && capturedKind === 'video' && (
        <VideoTrimStep
          previewUrl={previewUrl}
          videoDuration={videoDuration} setVideoDuration={setVideoDuration}
          trimStart={trimStart} setTrimStart={setTrimStart}
          trimEnd={trimEnd} setTrimEnd={setTrimEnd}
          trimming={trimming}
          onBack={() => setStep('preview')}
          onConfirm={async () => {
            const fullClip = trimStart <= 0.15 && trimEnd >= videoDuration - 0.15
            if (fullClip) { setStep('details'); return } // nothing meaningfully trimmed -- skip re-encoding
            setTrimming(true)
            setError('')
            try {
              const trimmed = await trimVideo(previewUrl, trimStart, trimEnd)
              setCapturedBlob(trimmed)
              if (previewUrl) URL.revokeObjectURL(previewUrl)
              setPreviewUrl(URL.createObjectURL(trimmed))
              setStep('details')
            } catch {
              setError("Couldn't trim that clip — posting it untrimmed instead.")
              setStep('details')
            } finally {
              setTrimming(false)
            }
          }}
        />
      )}

      {/* ── WRITE (text-only post) ── */}
      {step === 'write' && (
        <div className="flex-1 flex flex-col bg-[#141110]">
          <div className="flex items-center justify-between p-4 flex-shrink-0">
            <button onClick={() => setStep('camera')} className="text-white font-semibold text-[14px]">Back</button>
            <p className="text-white font-semibold text-[14px]">Write a post</p>
            <button onClick={() => setStep('details')} disabled={!caption.trim()} className="text-brand font-semibold text-[14px] disabled:opacity-40">Next</button>
          </div>
          <textarea
            value={caption} onChange={e => setCaption(e.target.value)} autoFocus
            placeholder="Share something educational…"
            className="flex-1 bg-transparent text-white text-[16px] p-4 outline-none resize-none placeholder-white/40"
          />
        </div>
      )}

      {/* ── DETAILS (caption + post, for a camera capture) ── */}
      {step === 'details' && (
        <div className="flex-1 flex flex-col bg-[#141110]">
          <div className="flex items-center justify-between p-4 flex-shrink-0">
            <button onClick={() => setStep(previewUrl ? 'preview' : 'write')} className="text-white font-semibold text-[14px]">Back</button>
            <p className="text-white font-semibold text-[14px]">New post</p>
            <div className="w-10" />
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {error && <p className="text-[13px] text-[#FFB89E] bg-[#3A241C] border border-[#5A3226] rounded-lg px-3.5 py-2.5">{error}</p>}
            {previewUrl && (
              <div className="rounded-xl overflow-hidden max-h-48 flex items-center justify-center bg-black">
                {capturedKind === 'photo' ? <img src={previewUrl} alt="" className="max-h-48 object-contain" /> : <video src={previewUrl} className="max-h-48 object-contain" />}
              </div>
            )}
            <textarea
              value={caption} onChange={e => setCaption(e.target.value)}
              placeholder="Add a caption…"
              rows={3}
              className="w-full bg-white/5 border border-[var(--app-border)] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/40 outline-none resize-none"
            />

            <div>
              <p className="text-[12.5px] font-semibold text-white/70 mb-2">Pick 2 stickers for this post</p>
              <div className="flex flex-wrap gap-2">
                {STICKER_OPTIONS.map(s => {
                  const active = stickers.includes(s.key)
                  return (
                    <button
                      key={s.key}
                      onClick={() => setStickers(prev =>
                        active ? prev.filter(k => k !== s.key)
                          : prev.length >= 2 ? [prev[1], s.key] : [...prev, s.key]
                      )}
                      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition ${
                        active ? 'border-brand bg-brand/15 text-white' : 'border-[var(--app-border)] bg-white/5 text-white/60'
                      }`}
                    >
                      <span>{s.emoji}</span> {s.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {isAdult && (
              <button
                onClick={() => setVisibility(v => v === 'organisation' ? 'public' : 'organisation')}
                className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white/70 px-3 py-2 rounded-lg bg-white/5 border border-[var(--app-border)]"
              >
                {visibility === 'public' ? <Globe className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                {visibility === 'public' ? 'Public — anyone on LERN' : 'Organisation only'}
              </button>
            )}
          </div>

          <div className="p-5 flex-shrink-0">
            <button
              onClick={handlePost} disabled={posting || (!caption.trim() && !capturedBlob)}
              className="w-full flex items-center justify-center gap-1.5 bg-brand text-white font-semibold text-[14px] py-3.5 rounded-2xl disabled:opacity-40 transition"
            >
              {posting ? 'Posting…' : <><Check className="w-4 h-4" /> Post</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function VideoTrimStep({
  previewUrl, videoDuration, setVideoDuration, trimStart, setTrimStart, trimEnd, setTrimEnd, trimming, onBack, onConfirm,
}: {
  previewUrl: string
  videoDuration: number; setVideoDuration: (n: number) => void
  trimStart: number; setTrimStart: (n: number) => void
  trimEnd: number; setTrimEnd: (n: number) => void
  trimming: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onMeta = () => {
      setVideoDuration(v.duration)
      setTrimEnd(Math.min(v.duration, MAX_RECORD_SECS))
    }
    v.addEventListener('loadedmetadata', onMeta)
    return () => v.removeEventListener('loadedmetadata', onMeta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const seekTo = (t: number) => { if (videoRef.current) videoRef.current.currentTime = t }

  return (
    <div className="flex-1 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 flex-shrink-0">
        <button onClick={onBack} className="text-white font-semibold text-[14px]">Back</button>
        <p className="text-white font-semibold text-[14px] flex items-center gap-1.5"><Scissors className="w-4 h-4" /> Trim</p>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex items-center justify-center">
        <video ref={videoRef} src={previewUrl} playsInline muted className="max-h-full max-w-full object-contain" />
      </div>

      <div className="flex-shrink-0 px-6 pb-8 pt-4">
        <div className="flex items-center justify-between text-white/70 text-[12.5px] font-semibold mb-2">
          <span>{fmtTime(trimStart)}</span>
          <span>{fmtTime(Math.max(0, trimEnd - trimStart))} selected</span>
          <span>{fmtTime(trimEnd)}</span>
        </div>
        {videoDuration > 0 && (
          <div className="space-y-3 mb-6">
            <input
              type="range" min={0} max={videoDuration} step={0.1} value={trimStart}
              onChange={e => {
                const clamped = Math.max(0, Math.min(Number(e.target.value), trimEnd - 0.2))
                setTrimStart(clamped); seekTo(clamped)
              }}
              className="w-full accent-brand"
            />
            <input
              type="range" min={0} max={videoDuration} step={0.1} value={trimEnd}
              onChange={e => {
                const clamped = Math.min(Math.max(Number(e.target.value), trimStart + 0.2), trimStart + MAX_RECORD_SECS, videoDuration)
                setTrimEnd(clamped); seekTo(clamped)
              }}
              className="w-full accent-brand"
            />
          </div>
        )}
        <button
          onClick={onConfirm} disabled={trimming || videoDuration === 0}
          className="w-full flex items-center justify-center gap-1.5 bg-brand text-white font-semibold text-[14px] py-3.5 rounded-2xl disabled:opacity-40 transition"
        >
          {trimming ? 'Trimming…' : 'Use this clip'}
        </button>
      </div>
    </div>
  )
}
