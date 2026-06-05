'use client'

import { useState, useRef } from 'react'
import { X, ImageIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { createCourse, supabase } from '@/lib/supabase'

interface CreateCourseProps {
  isOpen: boolean
  onClose: () => void
}

export default function CreateCourse({ isOpen, onClose }: CreateCourseProps) {
  const { user } = useAuth()

  if (isOpen && user?.account_type !== 'instructor') {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-[#252525] flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-[#888]" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">Instructors Only</h2>
          <p className="text-[#555] text-sm mb-6">You need to be an approved instructor to create courses. Apply in Settings.</p>
          <button onClick={onClose} className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-3 rounded-xl">Got it</button>
        </div>
      </div>
    )
  }
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [duration, setDuration] = useState('')
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const galleryRef = useRef<HTMLInputElement>(null)

  const subjects = ['TYPESCRIPT', 'JAVASCRIPT', 'REACT', 'PYTHON', 'FITNESS', 'MUSIC', 'BUSINESS']
  const levels = ['beginner', 'intermediate', 'advanced']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !title || !subject || !level) return

    setLoading(true)
    try {
      let thumbnailUrl: string | null = null
      if (thumbnail) {
        const ext  = thumbnail.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_thumb.${ext}`
        const { error: upErr } = await supabase.storage.from('course-thumbnails').upload(path, thumbnail)
        if (!upErr) {
          thumbnailUrl = supabase.storage.from('course-thumbnails').getPublicUrl(path).data.publicUrl
        }
      }

      await createCourse(user.id, {
        title,
        description,
        subject,
        level,
        duration_weeks: parseInt(duration) || 0,
        thumbnail_url: thumbnailUrl,
        rating: 0,
      })

      setTitle('')
      setDescription('')
      setSubject('')
      setLevel('')
      setDuration('')
      setThumbnail(null)
      onClose()
    } catch (error) {
      console.error('Error creating course:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-[rgba(255,255,255,0.07)]">
          <h2 className="text-white text-xl font-bold">Create Course</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-[#252525] rounded-full flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white text-sm font-semibold mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Course title"
              className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2 text-white placeholder-[#666] focus:border-[rgba(124,58,237,1)] transition outline-none"
            />
          </div>

          <div>
            <label className="block text-white text-sm font-semibold mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Course description"
              className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2 text-white placeholder-[#666] focus:border-[rgba(124,58,237,1)] transition outline-none resize-none h-20"
            />
          </div>

          <div>
            <label className="block text-white text-sm font-semibold mb-2">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2 text-white focus:border-[rgba(124,58,237,1)] transition outline-none"
            >
              <option value="">Select subject</option>
              {subjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-white text-sm font-semibold mb-2">Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2 text-white focus:border-[rgba(124,58,237,1)] transition outline-none"
            >
              <option value="">Select level</option>
              {levels.map(l => (
                <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-white text-sm font-semibold mb-2">Duration (weeks)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="4"
              className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2 text-white placeholder-[#666] focus:border-[rgba(124,58,237,1)] transition outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-[rgba(124,58,237,0.2)] hover:bg-[rgba(124,58,237,0.3)] text-white py-2 rounded-lg transition"
          >
            <ImageIcon className="w-4 h-4" />
            Add Thumbnail
          </button>

          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
            className="hidden"
          />

          <button
            type="submit"
            disabled={loading || !title || !subject || !level}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Course'}
          </button>
        </form>
        </div>
      </div>
    </div>
  )
}
