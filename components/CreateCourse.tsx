'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, ImageIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { createCourse, createCourseSessions, supabase } from '@/lib/supabase'

interface CreateCourseProps {
  isOpen: boolean
  onClose: () => void
}

const inputCls = 'w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition'
const labelCls = 'block text-[#888] text-[11px] font-bold uppercase tracking-wider mb-2'

const LEVELS = ['beginner','intermediate','advanced']

export default function CreateCourse({ isOpen, onClose }: CreateCourseProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [subject,     setSubject]     = useState('')
  const [level,       setLevel]       = useState('')
  const [duration,    setDuration]    = useState('')
  const [thumbnail,    setThumbnail]    = useState<File | null>(null)
  const [sessionCount, setSessionCount] = useState(8)
  const [projectName,  setProjectName]  = useState('')
  const [startDate,    setStartDate]    = useState('')
  const [endDate,      setEndDate]      = useState('')
  const [loading,      setLoading]      = useState(false)
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

  const canSubmit = !!(title && subject && level)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !canSubmit) return
    setLoading(true)
    try {
      let thumbnailUrl: string | null = null
      if (thumbnail) {
        const ext  = thumbnail.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_thumb.${ext}`
        const { error: upErr } = await supabase.storage.from('course-thumbnails').upload(path, thumbnail)
        if (!upErr) thumbnailUrl = supabase.storage.from('course-thumbnails').getPublicUrl(path).data.publicUrl
      }
      const { data: courseData } = await createCourse(user.id, {
        title, description, subject, level,
        duration_weeks: parseInt(duration) || 0,
        thumbnail_url: thumbnailUrl,
        start_date: startDate || null,
        end_date: endDate || null,
        rating: 0,
      })
      const newCourseId = (courseData as any)?.[0]?.id
      if (newCourseId && sessionCount > 0) {
        const baseDate = startDate ? new Date(startDate + 'T12:00:00') : null
        const sessions = Array.from({ length: sessionCount }, (_, i) => {
          let sessionDate: string | null = null
          if (baseDate) {
            const d = new Date(baseDate)
            d.setDate(d.getDate() + i * 7)
            sessionDate = d.toISOString().split('T')[0]
          }
          return {
            course_id: newCourseId,
            session_number: i + 1,
            title: i === sessionCount - 1
              ? `Projects Day${projectName ? ` — ${projectName}` : ''}`
              : `Session ${i + 1}`,
            session_date: sessionDate,
            session_time: '19:00',
            is_project_day: i === sessionCount - 1,
            is_live: false,
          }
        })
        await createCourseSessions(newCourseId, sessions)
      }
      setTitle(''); setDescription(''); setSubject(''); setLevel('')
      setDuration(''); setThumbnail(null); setSessionCount(8); setProjectName(''); setStartDate(''); setEndDate('')
      onClose()
      router.push('/courses')
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

        {/* Handle */}
        <div className="flex justify-center pt-3 flex-shrink-0">
          <div className="w-10 h-1 bg-[#333] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 flex-shrink-0 border-b border-[rgba(255,255,255,0.07)]">
          <h2 className="text-white text-xl font-bold">Create Course</h2>
          <button onClick={onClose} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Scrollable fields */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-5">

          <div>
            <label className={labelCls}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Course title" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What will learners gain?" rows={3} className={`${inputCls} resize-none`} />
          </div>

          {/* Subject — free text input */}
          <div>
            <label className={labelCls}>Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value.toUpperCase())}
              placeholder="e.g. PYTHON, FITNESS, MUSIC…"
              className={inputCls}
            />
          </div>

          {/* Level pills */}
          <div>
            <label className={labelCls}>Level</label>
            <div className="flex gap-2">
              {LEVELS.map(l => (
                <button key={l} type="button" onClick={() => setLevel(l)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold capitalize transition ${level === l ? 'bg-white text-black' : 'bg-[#252525] text-[#888] border border-[rgba(255,255,255,0.07)]'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Duration (weeks)</label>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="4" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Start Date <span className="text-[#444] normal-case font-normal">(optional)</span></label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={inputCls}
              min={new Date().toISOString().split('T')[0]}
            />
            {startDate && (
              <p className="text-[#444] text-xs mt-1">Sessions will be scheduled weekly from this date</p>
            )}
          </div>

          <div>
            <label className={labelCls}>End Date <span className="text-[#444] normal-case font-normal">(optional)</span></label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className={inputCls}
              min={startDate || new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Thumbnail */}
          {/* Sessions */}
          <div>
            <label className={labelCls}>Number of Sessions</label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button key={n} type="button" onClick={() => setSessionCount(n)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition ${sessionCount === n ? 'bg-white text-black' : 'bg-[#252525] text-[#888] border border-[rgba(255,255,255,0.07)]'}`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[#444] text-xs mt-2">Session {sessionCount} is always <span className="text-[#FF6B2B]">Projects Day</span></p>
          </div>

          <div>
            <label className={labelCls}>Project Name <span className="text-[#444] normal-case font-normal">(optional)</span></label>
            <input value={projectName} onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. Build a full TypeScript app" className={inputCls} />
          </div>

          <button type="button" onClick={() => galleryRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] text-[#888] text-sm py-3.5 rounded-2xl hover:text-white transition">
            <ImageIcon className="w-4 h-4" />
            {thumbnail ? thumbnail.name : 'Add Thumbnail'}
          </button>
          <input ref={galleryRef} type="file" accept="image/*" onChange={e => setThumbnail(e.target.files?.[0] || null)} className="hidden" />

        </div>

        {/* Sticky submit */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-[rgba(255,255,255,0.07)] bg-[#141414]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <button
            onClick={handleSubmit as any}
            disabled={loading || !canSubmit}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white font-bold py-4 rounded-2xl disabled:opacity-40 active:scale-[0.98] transition"
          >
            {loading ? 'Creating…' : 'Create Course'}
          </button>
        </div>
      </div>
    </div>
  )
}
