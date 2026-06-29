'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getCourseById, setSessionLive, supabase, rateCourse, getUserCourseRating } from '@/lib/supabase'
import { sendPushToMany } from '@/lib/push'
import dynamic from 'next/dynamic'
import { Loader2, Calendar, Clock, Star } from 'lucide-react'
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
  const [course,        setCourse]        = useState<any>(null)
  const [session,       setSession]       = useState<any>(null)
  const [loading,       setLoading]       = useState(true)
  const [showRating,    setShowRating]    = useState(false)
  const [ratingStars,   setRatingStars]   = useState(0)
  const [ratingDone,    setRatingDone]    = useState(false)

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

  // Instructor: mark session live and notify enrolled students
  useEffect(() => {
    if (!course || !user || !sessionId) return
    if (user.id !== course.instructor_id) return
    setSessionLive(sessionId, true).then(({ error }) => {
      if (!error) {
        // Notify all enrolled students
        supabase
          .from('enrollments')
          .select('user_id')
          .eq('course_id', courseId)
          .then(({ data: rows }) => {
            const ids = (rows || []).map((r: any) => r.user_id).filter((id: string) => id !== user.id)
            if (ids.length) {
              sendPushToMany(
                ids,
                '🔴 Class is starting!',
                `${course.title} is now live — join now`,
                `/courses/${courseId}/classroom?sessionId=${sessionId}`
              )
            }
          })
      }
    })
  }, [course, user, sessionId, courseId])

  // Realtime: watch is_live — gates students in; shows rating when class ends
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`session-live-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'course_sessions',
        filter: `id=eq.${sessionId}`,
      }, async (payload: any) => {
        setSession((prev: any) => prev ? { ...prev, ...payload.new } : prev)
        // Class just ended — prompt student to rate
        if (!payload.new.is_live && user && user.id !== course?.instructor_id) {
          const { data: existing } = await getUserCourseRating(courseId, user.id)
          if (!existing) setShowRating(true)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, user, courseId, course])

  if (loading || !course) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
      </div>
    )
  }

  const isInstructor = !!(user && user.id === course.instructor_id)

  // ── Rating overlay (shown to students when class ends) ──────
  if (showRating && !isInstructor) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center px-8 gap-6"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="text-center">
          <p className="text-white font-bold text-xl mb-1">Class has ended</p>
          <p className="text-[#888] text-sm mt-1">How was {course.title}?</p>
        </div>
        <div className="flex gap-3">
          {[1,2,3,4,5].map(star => (
            <button key={star} onClick={() => setRatingStars(star)}>
              <Star
                className="w-10 h-10 transition-colors"
                fill={star <= ratingStars ? '#facc15' : 'transparent'}
                color={star <= ratingStars ? '#facc15' : '#444'}
              />
            </button>
          ))}
        </div>
        {ratingDone ? (
          <p className="text-green-400 text-sm font-semibold">Thanks for rating!</p>
        ) : (
          <button
            disabled={ratingStars === 0}
            onClick={async () => {
              if (!user || ratingStars === 0) return
              await rateCourse(courseId, user.id, ratingStars)
              setRatingDone(true)
              setTimeout(() => router.back(), 1500)
            }}
            className="bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold px-10 py-3.5 rounded-full disabled:opacity-30"
          >
            Submit Rating
          </button>
        )}
        <button onClick={() => router.back()} className="text-[#555] text-sm">
          Skip
        </button>
      </div>
    )
  }

  // ── Time-gate for students ────────────────────────────────
  if (!isInstructor && session) {
    const isLive = session.is_live

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
            {session.title && <p className="text-[#555] text-sm mb-4">{session.title}</p>}
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

  const handleClose = async () => {
    if (isInstructor && sessionId) {
      // Just mark the session not-live. Sessions are never auto-completed from a classroom close
      // so instructors can reopen the same session without it showing as permanently done.
      await setSessionLive(sessionId, false)
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
      courseSubject={course.subject}
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
