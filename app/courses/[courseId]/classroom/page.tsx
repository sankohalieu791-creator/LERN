'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getCourseById, completeSession } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { Loader2, Calendar, Clock } from 'lucide-react'
import type { ComponentProps } from 'react'
import type VirtualClassroomType from '@/components/VirtualClassroom'

const VirtualClassroom = dynamic<ComponentProps<typeof VirtualClassroomType>>(
  () => import('@/components/VirtualClassroom'),
  { ssr: false }
)

function ClassroomInner() {
  const { courseId } = useParams<{ courseId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  const [course,   setCourse]   = useState<any>(null)
  const [session,  setSession]  = useState<any>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    getCourseById(courseId).then(({ data }) => {
      setCourse(data)
      if (data && sessionId) {
        const s = (data.course_sessions || []).find((s: any) => s.id === sessionId)
        setSession(s ?? null)
      }
      setLoading(false)
    })
  }, [courseId, sessionId])

  // Realtime: watch for instructor setting session is_live so the gate lifts automatically
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`session-live-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'course_sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload: any) => {
        setSession((prev: any) => prev ? { ...prev, is_live: payload.new.is_live } : prev)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  if (loading || !course) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
      </div>
    )
  }

  const isInstructor = !!(user && user.id === course.instructor_id)

  // ── Time-gate for students ────────────────────────────────
  if (!isInstructor && session) {
    const isLive = session.is_live

    // Build a JS Date from session_date + session_time if both exist
    let scheduledAt: Date | null = null
    if (session.session_date && session.session_time) {
      scheduledAt = new Date(`${session.session_date}T${session.session_time}`)
    }

    const tooEarly = scheduledAt ? Date.now() < scheduledAt.getTime() : false
    const notStarted = !isLive

    if (notStarted || tooEarly) {
      const dateLabel = scheduledAt
        ? scheduledAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
        : null
      const timeLabel = scheduledAt
        ? scheduledAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : null

      return (
        <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center px-8 gap-6"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="w-20 h-20 rounded-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] flex items-center justify-center">
            <span style={{ fontSize: 36 }}>⏳</span>
          </div>
          <div className="text-center">
            <p className="text-[#FF6B2B] text-xs font-bold uppercase tracking-[0.2em] mb-2">
              {tooEarly ? 'Class Not Started Yet' : 'Waiting for Instructor'}
            </p>
            <p className="text-white font-bold text-lg mb-1 line-clamp-2">{course.title}</p>
            {session.title && (
              <p className="text-[#555] text-sm mb-4">{session.title}</p>
            )}
            {(dateLabel || timeLabel) && (
              <div className="flex items-center justify-center gap-4 mt-3">
                {dateLabel && (
                  <div className="flex items-center gap-1.5 text-[#888] text-sm">
                    <Calendar className="w-4 h-4 text-[#FF6B2B]" />
                    {dateLabel}
                  </div>
                )}
                {timeLabel && (
                  <div className="flex items-center gap-1.5 text-[#888] text-sm">
                    <Clock className="w-4 h-4 text-[#1d9bf0]" />
                    {timeLabel}
                  </div>
                )}
              </div>
            )}
            {!tooEarly && (
              <p className="text-[#444] text-xs mt-4">
                This page will automatically update when the instructor starts the class.
              </p>
            )}
          </div>
          <button onClick={() => router.back()}
            className="mt-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] text-white font-semibold px-8 py-3 rounded-full text-sm">
            Go Back
          </button>
        </div>
      )
    }
  }

  // ── Workshop time-gate (workshop_date + workshop_time) ─────
  // (handled on the workshop detail page — no changes needed here)

  const handleClose = async () => {
    if (isInstructor && sessionId) {
      await completeSession(sessionId)
    }
    router.back()
  }

  return (
    <VirtualClassroom
      courseTitle={course.title}
      instructorName={course.users?.username || 'Instructor'}
      channelName={`course_${courseId}`}
      isInstructor={isInstructor}
      isOpen={true}
      onClose={handleClose}
      courseId={courseId}
    />
  )
}

export default function ClassroomPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
      </div>
    }>
      <ClassroomInner />
    </Suspense>
  )
}
