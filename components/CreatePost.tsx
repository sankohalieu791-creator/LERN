'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Loader2, Globe, Lock, Camera, RotateCcw, Circle, Square, SwitchCamera, Upload } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { createVideo, notifyFollowers } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

interface CreatePostProps {
  isOpen: boolean
  onClose: () => void
}

type PostType = 'video' | 'photo'
type Step = 'camera' | 'preview' | 'details'

const MAX_RECORD_SECONDS = 60

function fmtDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function uploadWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress: (pct: number) => void,
  cancelled: { current: boolean },
): Promise<string> {
  let pct = 0
  const ticker = setInterval(() => {
    if (cancelled.current) { clearInterval(ticker); return }
    const step = pct < 40 ? 3 + Math.random() * 4 : pct < 75 ? 1 + Math.random() * 2 : Math.random() * 0.5
    pct = Math.min(91, pct + step)
    onProgress(Math.round(pct))
  }, 350)

  try {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true })
    clearInterval(ticker)
    if (cancelled.current) throw new Error('cancelled')
    if (error) throw error
    onProgress(100)
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  } catch (e) {
    clearInterval(ticker)
    throw e
  }
}

export default function CreatePost({ isOpen, onClose }: CreatePostProps) {
  const { user, authUser } = useAuth()

  const [step,        setStep]        = useState<Step>('camera')
  const [postType,    setPostType]    = useState<PostType>('photo')
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [subject,     setSubject]     = useState('')
  const [duration,    setDuration]    = useState('0:00')
  const [thumbnail,   setThumbnail]   = useState<File | null>(null)
  const [video,       setVideo]       = useState<File | null>(null)
  const [thumbPreview, setThumbPreview] = useState<string | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [isPublic,    setIsPublic]    = useState(true)
  const [loading,     setLoading]     = useState(false)
  const [uploadPct,   setUploadPct]   = useState(0)
  const [error,       setError]       = useState('')

  // Camera state
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [cameraError, setCameraError] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)

  const liveVideoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const recorderRef   = useRef<MediaRecorder | null>(null)
  const chunksRef     = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const cancelledRef  = useRef(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError('')
    stopStream()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true,
      })
      streamRef.current = stream
      if (liveVideoRef.current) liveVideoRef.current.srcObject = stream
    } catch (e: any) {
      setCameraError(e?.name === 'NotAllowedError'
        ? 'Camera access was denied. Allow camera access, or choose a file instead.'
        : 'Could not access your camera. Choose a file instead.')
    }
  }, [facingMode, stopStream])

  useEffect(() => {
    if (!isOpen || step !== 'camera') return
    startCamera()
    return () => stopStream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step, facingMode])

  const reset = () => {
    setStep('camera'); setPostType('photo')
    setTitle(''); setDescription(''); setSubject(''); setDuration('0:00')
    setThumbnail(null); setVideo(null); setThumbPreview(null); setVideoPreview(null)
    setError(''); setIsPublic(true); setUploadPct(0)
    setRecording(false); setRecordSecs(0); setCameraError('')
  }

  const handleClose = () => {
    cancelledRef.current = true
    stopStream()
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    reset()
    onClose()
  }

  const captureFrame = (): Promise<File | null> => new Promise(resolve => {
    const v = liveVideoRef.current, c = canvasRef.current
    if (!v || !c || !v.videoWidth) { resolve(null); return }
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')?.drawImage(v, 0, 0)
    c.toBlob(blob => resolve(blob ? new File([blob], 'capture.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.92)
  })

  const handleSnapPhoto = async () => {
    const file = await captureFrame()
    if (!file) return
    setPostType('photo')
    setThumbnail(file)
    setThumbPreview(URL.createObjectURL(file))
    stopStream()
    setStep('preview')
  }

  const handleStartRecording = () => {
    const stream = streamRef.current
    if (!stream || typeof MediaRecorder === 'undefined') return
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find(t => MediaRecorder.isTypeSupported(t)) ?? ''
    chunksRef.current = []
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
      const file = new File([blob], 'capture.webm', { type: blob.type })
      setVideo(file)
      setVideoPreview(URL.createObjectURL(file))
      const thumb = await captureFrame()
      if (thumb) { setThumbnail(thumb); setThumbPreview(URL.createObjectURL(thumb)) }
      stopStream()
      setStep('preview')
    }
    recorder.start()
    recorderRef.current = recorder
    setRecording(true)
    setRecordSecs(0)
    recordTimerRef.current = setInterval(() => {
      setRecordSecs(s => {
        const next = s + 1
        if (next >= MAX_RECORD_SECONDS) handleStopRecording()
        return next
      })
    }, 1000)
  }

  const handleStopRecording = () => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    setRecording(false)
    setDuration(fmtDuration(recordSecs))
  }

  const handleShutter = () => {
    if (postType === 'photo') { handleSnapPhoto(); return }
    if (recording) handleStopRecording()
    else handleStartRecording()
  }

  const handleRetake = () => {
    setThumbnail(null); setVideo(null); setThumbPreview(null); setVideoPreview(null)
    setDuration('0:00')
    setStep('camera')
  }

  const handleFallbackFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      setPostType('photo')
      setThumbnail(file)
      setThumbPreview(URL.createObjectURL(file))
      setStep('preview')
    } else if (file.type.startsWith('video/')) {
      setPostType('video')
      setVideo(file)
      setVideoPreview(URL.createObjectURL(file))
      const el = document.createElement('video')
      el.preload = 'metadata'
      el.onloadedmetadata = () => { setDuration(fmtDuration(el.duration)); URL.revokeObjectURL(el.src) }
      el.src = URL.createObjectURL(file)
      setStep('preview')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const userId = user?.id ?? authUser?.id
    if (!userId || !title) {
      if (!userId) setError('Please wait a moment and try again')
      return
    }
    cancelledRef.current = false
    setLoading(true)
    setError('')
    setUploadPct(0)
    try {
      let thumbnailUrl: string | null = null
      let videoUrl:     string | null = null

      if (postType === 'photo' && thumbnail) {
        const path = `${userId}/${Date.now()}_photo.jpg`
        setUploadPct(30)
        const { error: e } = await supabase.storage.from('thumbnails').upload(path, thumbnail, { upsert: true })
        if (e) throw e
        thumbnailUrl = supabase.storage.from('thumbnails').getPublicUrl(path).data.publicUrl
        setUploadPct(100)
      } else {
        if (thumbnail) {
          const path = `${userId}/${Date.now()}_thumb.jpg`
          const { error: e } = await supabase.storage.from('thumbnails').upload(path, thumbnail, { upsert: true })
          if (!e) thumbnailUrl = supabase.storage.from('thumbnails').getPublicUrl(path).data.publicUrl
        }
        if (cancelledRef.current) return
        if (video) {
          const ext  = video.name.split('.').pop()
          const path = `${userId}/${Date.now()}_video.${ext}`
          videoUrl = await uploadWithProgress('videos', path, video, setUploadPct, cancelledRef)
        }
      }

      if (cancelledRef.current) return

      const { error: createErr, data: videoData } = await createVideo(userId, {
        title,
        description,
        subject: subject || 'general',
        duration: postType === 'photo' ? '' : duration,
        thumbnail_url: thumbnailUrl,
        video_url:     videoUrl,
        views:    0,
        is_public: isPublic,
      })
      if (createErr) throw createErr

      const newVideoId = (videoData as any)?.[0]?.id
      const poster = user ?? authUser
      if (newVideoId && poster) {
        const postTitle = postType === 'photo' ? '📸 New photo' : '🎬 New video'
        notifyFollowers(
          userId,
          'new_course',
          postTitle,
          `${(poster as any).username ?? 'Someone'} just posted: ${title}`,
          `/feed/${newVideoId}`,
          { id: userId, username: (poster as any).username ?? '', avatar_url: (poster as any).avatar_url ?? null }
        )
      }

      reset()
      onClose()
    } catch (err: any) {
      if (!cancelledRef.current) setError(err.message || 'Failed to post')
    } finally {
      if (!cancelledRef.current) setLoading(false)
    }
  }

  if (!isOpen) return null

  const isUploading = loading && uploadPct > 0 && uploadPct < 100

  // ── CAMERA STEP ────────────────────────────────────────────────
  if (step === 'camera') {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
          <button onClick={handleClose} className="w-9 h-9 bg-black/50 rounded-full flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="flex gap-2 bg-black/50 rounded-full p-1">
            <button
              onClick={() => setPostType('photo')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${postType === 'photo' ? 'bg-white text-black' : 'text-white'}`}
            >
              Photo
            </button>
            <button
              onClick={() => setPostType('video')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${postType === 'video' ? 'bg-white text-black' : 'text-white'}`}
            >
              Video
            </button>
          </div>
          <button
            onClick={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')}
            className="w-9 h-9 bg-black/50 rounded-full flex items-center justify-center"
          >
            <SwitchCamera className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 relative overflow-hidden bg-[#111] flex items-center justify-center">
          {cameraError ? (
            <div className="px-8 text-center">
              <Camera className="w-10 h-10 text-[#333] mx-auto mb-3" />
              <p className="text-[#888] text-sm mb-4">{cameraError}</p>
              <button onClick={startCamera} className="text-[#FF6B2B] text-sm font-semibold">Try again</button>
            </div>
          ) : (
            <video ref={liveVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          )}
          {recording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 rounded-full px-3 py-1.5">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-white text-xs font-bold">{fmtDuration(recordSecs)} / {fmtDuration(MAX_RECORD_SECONDS)}</span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col items-center gap-4 py-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
          <button
            onClick={handleShutter}
            disabled={!!cameraError}
            className="w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center disabled:opacity-30"
          >
            {postType === 'photo'
              ? <div className="w-14 h-14 rounded-full bg-white" />
              : recording
                ? <Square className="w-7 h-7 text-red-500 fill-red-500" />
                : <Circle className="w-14 h-14 text-red-500 fill-red-500" />
            }
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-[#888] text-xs font-semibold">
            <Upload className="w-3.5 h-3.5" /> Choose from device instead
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden"
          onChange={e => e.target.files?.[0] && handleFallbackFile(e.target.files[0])}
        />
      </div>
    )
  }

  // ── PREVIEW STEP ───────────────────────────────────────────────
  if (step === 'preview') {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
          <button onClick={handleClose} className="w-9 h-9 bg-black/50 rounded-full flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex-1 relative overflow-hidden bg-[#111] flex items-center justify-center">
          {postType === 'photo' && thumbPreview && (
            <img src={thumbPreview} className="w-full h-full object-contain" />
          )}
          {postType === 'video' && videoPreview && (
            <video src={videoPreview} controls playsInline className="w-full h-full object-contain" />
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
          <button
            onClick={handleRetake}
            className="flex-1 flex items-center justify-center gap-2 bg-[#252525] text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition"
          >
            <RotateCcw className="w-4 h-4" /> Retake
          </button>
          <button
            onClick={() => setStep('details')}
            className="flex-1 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition"
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // ── DETAILS STEP ───────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">

        <div className="flex items-center justify-between px-4 py-4 border-b border-[rgba(255,255,255,0.07)] sticky top-0 bg-[#1a1a1a] z-10">
          <h2 className="text-white font-bold text-lg">
            {postType === 'photo' ? 'Post Photo' : 'Post Video'}
          </h2>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#252525]">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">

          <button
            type="button"
            onClick={() => setStep('preview')}
            className="relative w-full aspect-video bg-[#111] rounded-xl overflow-hidden"
          >
            {thumbPreview && <img src={thumbPreview} className="w-full h-full object-cover" />}
            {postType === 'video' && (
              <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded-full">
                {duration}
              </span>
            )}
          </button>

          <div>
            <label className="block text-[#888] text-xs font-semibold mb-1.5 uppercase tracking-wide">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={postType === 'photo' ? 'What is this photo about?' : 'What is this video about?'}
              className="w-full bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)]"
            />
          </div>

          <div>
            <label className="block text-[#888] text-xs font-semibold mb-1.5 uppercase tracking-wide">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Tell viewers what to expect"
              rows={2}
              className="w-full bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] resize-none"
            />
          </div>

          <div>
            <label className="block text-[#888] text-xs font-semibold mb-1.5 uppercase tracking-wide">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Python, Fitness, Business…"
              className="w-full bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)]"
            />
          </div>

          <div>
            <label className="block text-[#888] text-xs font-semibold mb-2 uppercase tracking-wide">Visibility</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition ${
                  isPublic ? 'bg-white text-black border-white' : 'bg-[#111] border-[rgba(255,255,255,0.08)] text-[#555]'
                }`}
              >
                <Globe className="w-4 h-4" /> Public
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition ${
                  !isPublic ? 'bg-white text-black border-white' : 'bg-[#111] border-[rgba(255,255,255,0.08)] text-[#555]'
                }`}
              >
                <Lock className="w-4 h-4" /> Private
              </button>
            </div>
          </div>

          {isUploading && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#888] text-xs">
                  {postType === 'photo' ? 'Uploading photo…' : 'Uploading video…'}
                </span>
                <span className="text-[#FF6B2B] text-xs font-bold">{uploadPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#333] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] rounded-full transition-all duration-300"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
              {postType === 'video' && (
                <p className="text-[#444] text-[11px] mt-1.5">Large files may take a few minutes — keep this screen open</p>
              )}
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2.5 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !title || (postType === 'photo' && !thumbnail) || (postType === 'video' && !video)}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />{isUploading ? `Uploading ${uploadPct}%…` : 'Saving…'}</>
              : postType === 'photo' ? 'Post Photo' : 'Post Video'
            }
          </button>
        </form>
      </div>
    </div>
  )
}
