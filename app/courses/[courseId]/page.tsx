'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCourseById, enrollCourse, isEnrolled, getCourseProject, getMyProjectSubmission, supabase } from '@/lib/supabase'
import { sendPush } from '@/lib/push'
import { useAuth } from '@/context/AuthContext'
import { Clock, Users, Calendar, ChevronLeft, Loader2, FileText, CheckCircle, XCircle, File, ArrowRight } from 'lucide-react'
import Link from 'next/link'

function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center bg-[#1d9bf0] rounded-full flex-shrink-0"
      style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ width: size * 0.58, height: size * 0.58 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'accepted') return (
    <span className="flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold px-3 py-1.5 rounded-full">
      <CheckCircle className="w-3.5 h-3.5" /> Accepted
    </span>
  )
  if (status === 'declined') return (
    <span className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold px-3 py-1.5 rounded-full">
      <XCircle className="w-3.5 h-3.5" /> Declined — Try Again
    </span>
  )
  return (
    <span className="flex items-center gap-1.5 bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-xs font-bold px-3 py-1.5 rounded-full">
      <Clock className="w-3.5 h-3.5" /> Pending Review
    </span>
  )
}

export default function CourseDetailPage() {
  const { courseId } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [course, setCourse] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(false)
  const [enrolling, setEnrolling] = useState(false)

  // Project brief + this student's submission (read-only here; full flow lives on the Project Day page)
  const [project, setProject] = useState<any>(null)
  const [submission, setSubmission] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await getCourseById(courseId as string)
      setCourse(data)
      setSessions(
        (data?.course_sessions || []).slice().sort((a: any, b: any) =>
          new Date(a.session_date || 0).getTime() - new Date(b.session_date || 0).getTime()
        )
      )
      if (user) {
        const [{ data: e }, { data: proj }] = await Promise.all([
          isEnrolled(courseId as string, user.id),
          getCourseProject(courseId as string),
        ])
        setEnrolled(!!e)
        setProject(proj)
        if (proj) {
          const { data: sub } = await getMyProjectSubmission(user.id, proj.id)
          setSubmission(sub)
        }
      }
      setLoading(false)
    }
    load()
  }, [courseId, user])

  // Realtime: watch for any session on this course going live/ending
  useEffect(() => {
    if (!courseId) return
    const channel = supabase
      .channel(`course-sessions-live-${courseId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'course_sessions',
        filter: `course_id=eq.${courseId}`,
      }, (payload: any) => {
        setSessions(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [courseId])

  const handleEnroll = async () => {
    if (!user) { router.push('/auth/login'); return }
    setEnrolling(true)
    await enrollCourse(courseId as string, user.id)
    setEnrolled(true)
    setEnrolling(false)
    if (course?.instructor_id) {
      sendPush(
        course.instructor_id,
        '🎓 New enrollment',
        `${(user as any).username || 'Someone'} enrolled in ${course.title}`,
        '/dashboard'
      )
    }
  }


  if (loading) return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
    </div>
  )

  if (!course) return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center">
      <p className="text-[#555]">Course not found</p>
    </div>
  )

  const isInstructor = !!(user && user.id === (course.instructor_id || course.user_id))

  // Session routing helpers
  const nextSession      = sessions.find((s: any) => !s.is_completed)
  const liveSession      = sessions.find((s: any) => s.is_live)
  const isProjectDay     = nextSession?.is_project_day ?? false
  const isLiveProjectDay = liveSession?.is_project_day ?? false
  const courseComplete   = sessions.length > 0 && !nextSession && !liveSession

  // Project Day opens for students once the taught sessions are done — no need to wait for the instructor to go live.
  const projectDaySession = sessions.find((s: any) => s.is_project_day)
  const teachingSessions  = sessions.filter((s: any) => !s.is_project_day)
  const teachingDone      = teachingSessions.length > 0
    ? teachingSessions.every((s: any) => s.is_completed)
    : sessions.every((s: any) => s.is_completed)
  const projectDayOpen    = !!(projectDaySession && !projectDaySession.is_completed
    && (projectDaySession.is_live || teachingDone))

  const instructorUrl = nextSession
    ? isProjectDay
      ? `/courses/${courseId}/project-day?sessionId=${nextSession.id}`
      : `/courses/${courseId}/classroom?sessionId=${nextSession.id}`
    : `/courses/${courseId}/classroom`

  const studentUrl = liveSession
    ? isLiveProjectDay
      ? `/courses/${courseId}/project-day?sessionId=${liveSession.id}`
      : `/courses/${courseId}/classroom?sessionId=${liveSession.id}`
    : projectDayOpen
      ? `/courses/${courseId}/project-day?sessionId=${projectDaySession.id}`
      : null

  const instructorLabel = liveSession
    ? (isProjectDay ? 'View Submissions' : 'Resume Live Class')
    : (isProjectDay ? 'Open Project Day' : 'Start Live Class')

  const studentLabel = (isLiveProjectDay || (projectDayOpen && !liveSession))
    ? 'Submit Your Project'
    : 'Enter Live Classroom'

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] overflow-y-auto">

      {/* HEADER */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-[rgba(255,255,255,0.06)]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
        <button onClick={() => router.back()}
          className="w-9 h-9 bg-[#1a1a1a] rounded-full flex items-center justify-center flex-shrink-0">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white font-bold text-base leading-snug flex-1 line-clamp-1">{course.title}</h1>
        {liveSession && (
          <span className="flex items-center gap-1.5 bg-red-500/20 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-500/30">
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> LIVE
          </span>
        )}
      </div>

      {/* CONTENT */}
      <div className="px-4 pt-5 pb-4">

        {/* Instructor */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
            {course.users?.avatar_url
              ? <img src={course.users.avatar_url} className="w-full h-full object-cover" />
              : course.users?.username?.[0]?.toUpperCase()
            }
          </div>
          <div>
            <p className="text-white text-sm font-bold flex items-center gap-1.5">
              {course.users?.username}
              {course.users?.verified && <VerifiedBadge size={13} />}
            </p>
            <p className="text-[#555] text-xs">Instructor</p>
          </div>
        </div>

        {course.description && (
          <p className="text-[#888] text-sm leading-relaxed mb-5 border-b border-[rgba(255,255,255,0.06)] pb-5">
            {course.description}
          </p>
        )}

        {/* ── PROJECT SECTION (read-only summary — full flow lives on Project Day) ──
            Hidden from students until the course is finished (Project Day open) or
            they already submitted. Instructors always see it to set up / review. */}
        {project && (isInstructor || projectDayOpen || submission) && (
          <div className="border-t border-[rgba(255,255,255,0.07)] pt-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-[#FF6B2B]" />
              <p className="text-white text-sm font-bold uppercase tracking-wide">Course Project</p>
            </div>

            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#161616] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 mb-4">
              <h3 className="text-white font-bold text-base mb-2">{project.title}</h3>
              {project.description && (
                <p className="text-[#888] text-sm leading-relaxed mb-3">{project.description}</p>
              )}
              {project.due_date && (
                <div className="flex items-center gap-2 text-[#FF6B2B] text-xs font-semibold">
                  <Calendar className="w-3.5 h-3.5" />
                  Due {new Date(project.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>

            {/* Student: submission status (read-only) */}
            {!isInstructor && enrolled && submission && (
              <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[rgba(255,255,255,0.07)] mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white font-bold text-sm">Your Submission</p>
                  <StatusBadge status={submission.status} />
                </div>
                {submission.description && (
                  <p className="text-[#888] text-sm mb-2">{submission.description}</p>
                )}
                {submission.file_url && (
                  <a href={submission.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#1d9bf0] text-xs font-semibold">
                    <File className="w-3.5 h-3.5" /> View submitted file
                  </a>
                )}
                {submission.feedback && (
                  <div className="mt-3 bg-[#111] rounded-xl p-3 border border-[rgba(255,255,255,0.06)]">
                    <p className="text-[#555] text-[10px] font-bold uppercase tracking-wider mb-1">Instructor Feedback</p>
                    <p className="text-[#888] text-sm">{submission.feedback}</p>
                  </div>
                )}
              </div>
            )}

            {/* Everyone: manage on the Project Day page */}
            {isInstructor ? (
              <Link
                href={`/courses/${courseId}/project-day${projectDaySession ? `?sessionId=${projectDaySession.id}` : ''}`}
                className="flex items-center justify-center gap-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-white font-bold py-3.5 rounded-2xl text-sm"
              >
                <Users className="w-4 h-4 text-[#888]" /> Review Submissions <ArrowRight className="w-3.5 h-3.5 text-[#888]" />
              </Link>
            ) : enrolled && projectDayOpen ? (
              <Link
                href={`/courses/${courseId}/project-day${projectDaySession ? `?sessionId=${projectDaySession.id}` : ''}`}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-3.5 rounded-2xl text-sm"
              >
                {submission ? 'Open Project Day' : 'Submit Your Project'} <ArrowRight className="w-4 h-4" />
              </Link>
            ) : null}
          </div>
        )}

        {/* Instructor: no brief yet — set it up on the Project Day page */}
        {isInstructor && !project && (
          <div className="border-t border-[rgba(255,255,255,0.07)] pt-6">
            <Link
              href={`/courses/${courseId}/project-day${projectDaySession ? `?sessionId=${projectDaySession.id}` : ''}`}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-[rgba(255,255,255,0.15)] text-[#555] font-semibold py-3.5 rounded-2xl text-sm hover:text-white hover:border-[rgba(255,255,255,0.3)] transition"
            >
              <FileText className="w-4 h-4" /> Set Up Project Day Brief
            </Link>
          </div>
        )}

        {/* Spacer so content isn't hidden behind the fixed bottom button (incl. device safe area) */}
        <div style={{ height: 'calc(env(safe-area-inset-bottom) + 140px)' }} />
      </div>

      {/* STICKY ENROLL/JOIN BUTTON */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-[#0f0f0f] border-t border-[rgba(255,255,255,0.07)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        {courseComplete ? (
          <div className="w-full flex items-center justify-center gap-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] text-[#555] font-bold py-4 rounded-2xl text-sm">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Course Complete
          </div>
        ) : isInstructor ? (
          <Link
            href={instructorUrl}
            className="block w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl text-center"
          >
            {instructorLabel}
          </Link>
        ) : enrolled ? (
          studentUrl ? (
            <Link
              href={studentUrl}
              className="block w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl text-center"
            >
              {studentLabel}
            </Link>
          ) : (
            <div className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] text-[#555] font-bold py-4 rounded-2xl text-center text-sm">
              No Live Class Right Now
            </div>
          )
        ) : (
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {enrolling ? <><Loader2 className="w-4 h-4 animate-spin" />Enrolling…</> : 'Enroll — Free'}
          </button>
        )}
      </div>
    </div>
  )
}
