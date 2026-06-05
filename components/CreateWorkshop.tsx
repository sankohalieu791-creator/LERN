'use client'

import { useState, useRef } from 'react'
import { X, ImageIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { createWorkshop, supabase } from '@/lib/supabase'

interface CreateWorkshopProps {
  isOpen: boolean
  onClose: () => void
}

export default function CreateWorkshop({ isOpen, onClose }: CreateWorkshopProps) {
  const { user } = useAuth()

  if (isOpen && !user?.is_instructor) {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-[#252525] flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-[#888]" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">Instructors Only</h2>
          <p className="text-[#555] text-sm mb-6">You need to be an approved instructor to create workshops. Apply in Settings.</p>
          <button onClick={onClose} className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-3 rounded-xl">Got it</button>
        </div>
      </div>
    )
  }
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [maxParticipants, setMaxParticipants] = useState('')
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const galleryRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !title || !date || !time) return

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

      await createWorkshop(user.id, {
        title,
        description,
        workshop_date: date,
        workshop_time: time,
        location: location || 'Online',
        is_online: isOnline,
        max_participants: parseInt(maxParticipants) || 30,
        thumbnail_url: thumbnailUrl,
      })

      setTitle('')
      setDescription('')
      setDate('')
      setTime('')
      setLocation('')
      setIsOnline(true)
      setMaxParticipants('')
      setThumbnail(null)
      onClose()
    } catch (error) {
      console.error('Error creating workshop:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#1a1a1a]">
          <h2 className="text-white text-xl font-bold">Create Workshop</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[rgba(124,58,237,0.2)] rounded-full transition"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white text-sm font-semibold mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Workshop title"
              className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2 text-white placeholder-[#666] focus:border-[rgba(124,58,237,1)] transition outline-none"
            />
          </div>

          <div>
            <label className="block text-white text-sm font-semibold mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Workshop description"
              className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2 text-white placeholder-[#666] focus:border-[rgba(124,58,237,1)] transition outline-none resize-none h-20"
            />
          </div>

          <div>
            <label className="block text-white text-sm font-semibold mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2 text-white focus:border-[rgba(124,58,237,1)] transition outline-none"
            />
          </div>

          <div>
            <label className="block text-white text-sm font-semibold mb-2">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2 text-white focus:border-[rgba(124,58,237,1)] transition outline-none"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isOnline}
                onChange={(e) => setIsOnline(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-white text-sm">Online</span>
            </label>
          </div>

          {!isOnline && (
            <div>
              <label className="block text-white text-sm font-semibold mb-2">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Workshop location"
                className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2 text-white placeholder-[#666] focus:border-[rgba(124,58,237,1)] transition outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-white text-sm font-semibold mb-2">Max Participants</label>
            <input
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              placeholder="30"
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
            disabled={loading || !title || !date || !time}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Workshop'}
          </button>
        </form>
      </div>
    </div>
  )
}
