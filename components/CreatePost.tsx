'use client'

import { useState, useRef } from 'react'
import { X, Upload, Image as ImageIcon, Loader2, Globe, Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { createVideo } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

interface CreatePostProps {
  isOpen: boolean
  onClose: () => void
}

function detectDuration(file: File): Promise<string> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const el  = document.createElement('video')
    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      const total = Math.floor(el.duration)
      const m = Math.floor(total / 60)
      const s = total % 60
      resolve(`${m}:${s.toString().padStart(2, '0')}`)
      URL.revokeObjectURL(url)
    }
    el.onerror = () => { resolve('0:00'); URL.revokeObjectURL(url) }
    el.src = url
  })
}

function fmtSize(bytes: number) {
  if (bytes >= 1_000_000_000) return (bytes / 1_000_000_000).toFixed(1) + ' GB'
  if (bytes >= 1_000_000)     return (bytes / 1_000_000).toFixed(1) + ' MB'
  return (bytes / 1_000).toFixed(0) + ' KB'
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
  const { user } = useAuth()
  const [title,        setTitle]        = useState('')
  const [description,  setDescription]  = useState('')
  const [subject,      setSubject]       = useState('')
  const [duration,     setDuration]      = useState('0:00')
  const [thumbnail,    setThumbnail]     = useState<File | null>(null)
  const [video,        setVideo]         = useState<File | null>(null)
  const [thumbPreview, setThumbPreview]  = useState<string | null>(null)
  const [isPublic,     setIsPublic]      = useState(true)
  const [loading,      setLoading]       = useState(false)
  const [uploadPct,    setUploadPct]     = useState(0)
  const [error,        setError]         = useState('')

  const videoRef    = useRef<HTMLInputElement>(null)
  const thumbRef    = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)

  const reset = () => {
    setTitle(''); setDescription(''); setSubject(''); setDuration('0:00')
    setThumbnail(null); setVideo(null); setThumbPreview(null)
    setError(''); setIsPublic(true); setUploadPct(0)
  }

  const handleClose = () => {
    cancelledRef.current = true
    reset()
    onClose()
  }

  const handleVideoSelect = async (file: File) => {
    setVideo(file)
    const dur = await detectDuration(file)
    setDuration(dur)
  }

  const handleThumbSelect = (file: File) => {
    setThumbnail(file)
    setThumbPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !title) return
    cancelledRef.current = false
    setLoading(true)
    setError('')
    setUploadPct(0)
    try {
      let thumbnailUrl: string | null = null
      let videoUrl:     string | null = null

      if (thumbnail) {
        const ext  = thumbnail.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_thumb.${ext}`
        const { error: e } = await supabase.storage.from('thumbnails').upload(path, thumbnail, { upsert: true })
        if (!e) thumbnailUrl = supabase.storage.from('thumbnails').getPublicUrl(path).data.publicUrl
      }

      if (cancelledRef.current) return

      if (video) {
        const ext  = video.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_video.${ext}`
        videoUrl = await uploadWithProgress('videos', path, video, setUploadPct, cancelledRef)
      }

      if (cancelledRef.current) return

      const { error: createErr } = await createVideo(user.id, {
        title,
        description,
        subject: subject || 'general',
        duration,
        thumbnail_url: thumbnailUrl,
        video_url:     videoUrl,
        views:    0,
        is_public: isPublic,
      })
      if (createErr) throw createErr
      reset()
      onClose()
    } catch (err: any) {
      if (!cancelledRef.current) setError(err.message || 'Failed to post')
    } finally {
      if (!cancelledRef.current) setLoading(false)
    }
  }

  if (!isOpen) return null

  const isUploading = loading && video && uploadPct < 100

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[rgba(255,255,255,0.07)] sticky top-0 bg-[#1a1a1a] z-10">
          <h2 className="text-white font-bold text-lg">Post Video</h2>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#252525]">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>}

          {/* THUMBNAIL PREVIEW */}
          <button
            type="button"
            onClick={() => thumbRef.current?.click()}
            className="relative w-full aspect-video bg-[#111] border-2 border-dashed border-[rgba(255,255,255,0.1)] rounded-xl overflow-hidden flex flex-col items-center justify-center gap-2 hover:border-[rgba(255,255,255,0.2)] transition"
          >
            {thumbPreview
              ? <img src={thumbPreview} className="w-full h-full object-cover absolute inset-0" />
              : <>
                  <ImageIcon className="w-8 h-8 text-[#333]" />
                  <p className="text-[#444] text-xs">Tap to add thumbnail</p>
                </>
            }
          </button>

          <div>
            <label className="block text-[#888] text-xs font-semibold mb-1.5 uppercase tracking-wide">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What is this video about?"
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

          {/* PUBLIC / PRIVATE */}
          <div>
            <label className="block text-[#888] text-xs font-semibold mb-2 uppercase tracking-wide">Visibility</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition ${
                  isPublic
                    ? 'bg-white text-black border-white'
                    : 'bg-[#111] border-[rgba(255,255,255,0.08)] text-[#555]'
                }`}
              >
                <Globe className="w-4 h-4" /> Public
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition ${
                  !isPublic
                    ? 'bg-white text-black border-white'
                    : 'bg-[#111] border-[rgba(255,255,255,0.08)] text-[#555]'
                }`}
              >
                <Lock className="w-4 h-4" /> Private
              </button>
            </div>
          </div>

          {/* VIDEO UPLOAD */}
          <button
            type="button"
            onClick={() => !loading && videoRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-[#111] border border-[rgba(255,255,255,0.08)] text-sm py-3 rounded-xl transition hover:border-[rgba(255,255,255,0.18)]"
          >
            <Upload className="w-4 h-4 text-[#888]" />
            {video
              ? <span className="text-[#FF6B2B] font-semibold truncate max-w-[220px]">
                  {video.name.slice(0, 28)} · {duration} · {fmtSize(video.size)}
                </span>
              : <span className="text-[#888]">Select video file</span>
            }
          </button>

          {/* UPLOAD PROGRESS */}
          {isUploading && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#888] text-xs">Uploading video…</span>
                <span className="text-[#FF6B2B] text-xs font-bold">{uploadPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#333] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] rounded-full transition-all duration-300"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
              <p className="text-[#444] text-[11px] mt-1.5">Large files may take a few minutes — keep this screen open</p>
            </div>
          )}

          <input ref={thumbRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleThumbSelect(e.target.files[0])} />
          <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={e => e.target.files?.[0] && handleVideoSelect(e.target.files[0])} />

          <button
            type="submit"
            disabled={loading || !title}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />{isUploading ? `Uploading ${uploadPct}%…` : 'Saving…'}</>
              : 'Post Video'
            }
          </button>
        </form>
      </div>
    </div>
  )
}
