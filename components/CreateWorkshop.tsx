'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, ImageIcon, Globe, MapPin } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { createWorkshop, supabase } from '@/lib/supabase'

interface CreateWorkshopProps {
  isOpen: boolean
  onClose: () => void
}

const inputCls = 'w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition'
const labelCls = 'block text-[#888] text-[11px] font-bold uppercase tracking-wider mb-2'

export default function CreateWorkshop({ isOpen, onClose }: CreateWorkshopProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [date,        setDate]        = useState('')
  const [time,        setTime]        = useState('')
  const [location,    setLocation]    = useState('')
  const [isOnline,    setIsOnline]    = useState(false)
  const [thumbnail,   setThumbnail]   = useState<File | null>(null)
  const [loading,     setLoading]     = useState(false)
  const galleryRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  if (user?.account_type !== 'instructor') {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/70" onClick={onClose} />
        <div className="relative bg-[#141414] rounded-t-3xl px-5 pt-8 pb-10 text-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}>
          <p className="text-white font-bold text-lg mb-2">Instructors Only</p>
          <p className="text-[#555] text-sm mb-6">Apply to be an instructor in Settings.</p>
          <button onClick={onClose} className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl">Got it</button>
        </div>
      </div>
    )
  }

  const canSubmit = isOnline
    ? !!(title && date && time)
    : !!(title && date && time && location)

  const handleSubmit = async () => {
    if (!user || !canSubmit) return
    setLoading(true)
    try {
      let thumbnailUrl: string | null = null
      if (thumbnail) {
        const ext  = thumbnail.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_workshop.${ext}`
        const { error: upErr } = await supabase.storage.from('course-thumbnails').upload(path, thumbnail)
        if (!upErr) thumbnailUrl = supabase.storage.from('course-thumbnails').getPublicUrl(path).data.publicUrl
      }
      await createWorkshop(user.id, {
        title,
        description,
        workshop_date: date,
        workshop_time: time,
        location: isOnline ? null : location,
        is_online: isOnline,
        enrolled_count: 0,
        thumbnail_url: thumbnailUrl,
      })
      setTitle(''); setDescription(''); setDate(''); setTime('')
      setLocation(''); setIsOnline(false); setThumbnail(null)
      onClose()
      router.push('/courses?tab=workshops')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#141414] rounded-t-3xl flex flex-col" style={{ maxHeight: '92vh' }}>

        <div className="flex justify-center pt-3 flex-shrink-0">
          <div className="w-10 h-1 bg-[#333] rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 pt-3 pb-4 flex-shrink-0 border-b border-[rgba(255,255,255,0.07)]">
          <h2 className="text-white text-xl font-bold">Create Workshop</h2>
          <button onClick={onClose} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-5">

          {/* Online / In-Person toggle */}
          <div>
            <label className={labelCls}>Format</label>
            <div className="flex gap-2 bg-[#111] rounded-xl p-1">
              <button
                type="button"
                onClick={() => setIsOnline(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${
                  !isOnline ? 'bg-white text-black' : 'text-[#555]'
                }`}
              >
                <MapPin className="w-4 h-4" /> In-Person
              </button>
              <button
                type="button"
                onClick={() => setIsOnline(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${
                  isOnline ? 'bg-white text-black' : 'text-[#555]'
                }`}
              >
                <Globe className="w-4 h-4" /> Online
              </button>
            </div>
            {isOnline && (
              <p className="text-[#555] text-[11px] mt-2 px-1">
                A virtual classroom will be available at the scheduled time.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Workshop title" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What will attendees learn?" rows={3} className={`${inputCls} resize-none`} />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </div>
            <div className="w-36">
              <label className={labelCls}>Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} />
            </div>
          </div>

          {!isOnline && (
            <div>
              <label className={labelCls}>Location</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Address or venue" className={inputCls} />
            </div>
          )}

          <button type="button" onClick={() => galleryRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] text-[#888] text-sm py-3.5 rounded-2xl hover:text-white transition">
            <ImageIcon className="w-4 h-4" />
            {thumbnail ? thumbnail.name : 'Add Thumbnail'}
          </button>
          <input ref={galleryRef} type="file" accept="image/*" onChange={e => setThumbnail(e.target.files?.[0] || null)} className="hidden" />

        </div>

        <div className="flex-shrink-0 px-5 py-4 border-t border-[rgba(255,255,255,0.07)] bg-[#141414]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <button
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white font-bold py-4 rounded-2xl disabled:opacity-40 active:scale-[0.98] transition"
          >
            {loading ? 'Creating…' : 'Create Workshop'}
          </button>
        </div>
      </div>
    </div>
  )
}
