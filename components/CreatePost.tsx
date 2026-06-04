'use client'

import { useState, useRef } from 'react'
import { X, Upload, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { createVideo } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

interface CreatePostProps {
  isOpen: boolean
  onClose: () => void
}

const SUBJECTS = ['TYPESCRIPT', 'JAVASCRIPT', 'REACT', 'PYTHON', 'FITNESS', 'MUSIC', 'BUSINESS', 'EXAM PREP', 'SPANISH']

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

export default function CreatePost({ isOpen, onClose }: CreatePostProps) {
  const { user } = useAuth()
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [subject,     setSubject]     = useState('')
  const [duration,    setDuration]    = useState('0:00')
  const [thumbnail,   setThumbnail]   = useState<File | null>(null)
  const [video,       setVideo]       = useState<File | null>(null)
  const [thumbPreview, setThumbPreview] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const videoRef = useRef<HTMLInputElement>(null)
  const thumbRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setTitle(''); setDescription(''); setSubject(''); setDuration('0:00')
    setThumbnail(null); setVideo(null); setThumbPreview(null); setError('')
  }

  const handleClose = () => { reset(); onClose() }

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
    if (!user || !title || !subject) return
    setLoading(true)
    setError('')
    try {
      let thumbnailUrl: string | null = null
      let videoUrl:     string | null = null

      if (thumbnail) {
        const ext  = thumbnail.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_thumb.${ext}`
        const { error: e } = await supabase.storage.from('thumbnails').upload(path, thumbnail)
        if (!e) thumbnailUrl = supabase.storage.from('thumbnails').getPublicUrl(path).data.publicUrl
      }

      if (video) {
        const ext  = video.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_video.${ext}`
        const { error: e } = await supabase.storage.from('videos').upload(path, video)
        if (!e) videoUrl = supabase.storage.from('videos').getPublicUrl(path).data.publicUrl
      }

      const { error: createErr } = await createVideo(user.id, {
        title, description, subject, duration,
        thumbnail_url: thumbnailUrl,
        video_url:     videoUrl,
        views: 0,
      })
      if (createErr) throw createErr
      reset()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to post')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

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
            <label className="block text-[#888] text-xs font-semibold mb-1.5 uppercase tracking-wide">Subject *</label>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-white text-sm outline-none appearance-none"
            >
              <option value="">Select subject</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* VIDEO UPLOAD */}
          <button
            type="button"
            onClick={() => videoRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-[#111] border border-[rgba(255,255,255,0.08)] text-sm py-3 rounded-xl transition hover:border-[rgba(255,255,255,0.18)]"
          >
            <Upload className="w-4 h-4 text-[#888]" />
            {video
              ? <span className="text-[#FF6B2B] font-semibold">{video.name.slice(0, 30)} · {duration}</span>
              : <span className="text-[#888]">Upload video (duration auto-detected)</span>
            }
          </button>

          <input ref={thumbRef} type="file" accept="image/*"  className="hidden" onChange={e => e.target.files?.[0] && handleThumbSelect(e.target.files[0])} />
          <input ref={videoRef} type="file" accept="video/*"  className="hidden" onChange={e => e.target.files?.[0] && handleVideoSelect(e.target.files[0])} />

          <button
            type="submit"
            disabled={loading || !title || !subject}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</> : 'Post Video'}
          </button>
        </form>
      </div>
    </div>
  )
}
