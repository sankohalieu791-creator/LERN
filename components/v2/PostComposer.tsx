'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createPost, uploadPostImage, uploadPostVideo } from '@/lib/supabase'
import { X, RotateCcw, Timer, Video, Image as ImageIcon, Type, Circle, Square, Globe, Users, Check } from 'lucide-react'

type Step = 'camera' | 'preview' | 'write' | 'details'
type CaptureMode = 'photo' | 'video'
const MAX_RECORD_SECS = 60

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
  const [visibility, setVisibility] = useState<'organisation' | 'public'>('organisation')
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

  // ── Camera stream ──
  const startStream = async (facing: 'environment' | 'user') => {
    stopStream()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: mode === 'video',
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
  }, [step, facingMode, mode])

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
    const { error: postErr } = await createPost(user.organisation_id, user.id, { content: caption.trim() || undefined, image_path, video_path, visibility })
    setPosting(false)
    if (postErr) { setError(postErr.message); return }
    onPosted()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* ── CAMERA ── */}
      {step === 'camera' && (
        <div className="flex-1 flex flex-col relative">
          <video ref={videoRef} autoPlay playsInline muted className={`flex-1 w-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`} />

          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4">
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center"><X className="w-5 h-5" /></button>
            <div className="flex items-center gap-2">
              <button onClick={() => setTimerOn(t => !t)} className={`w-10 h-10 rounded-full flex items-center justify-center ${timerOn ? 'bg-brand text-white' : 'bg-black/40 text-white'}`}>
                <Timer className="w-5 h-5" />
              </button>
              <button onClick={flipCamera} className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center"><RotateCcw className="w-5 h-5" /></button>
            </div>
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
            <button onClick={() => setStep('details')} className="bg-white text-black font-semibold text-[14px] px-6 py-2.5 rounded-full">Next</button>
          </div>
        </div>
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
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/40 outline-none resize-none"
            />
            {isAdult && (
              <button
                onClick={() => setVisibility(v => v === 'organisation' ? 'public' : 'organisation')}
                className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white/70 px-3 py-2 rounded-lg bg-white/5 border border-white/10"
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
