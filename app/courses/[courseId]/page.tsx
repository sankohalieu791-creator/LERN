'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCourseById, enrollCourse, isEnrolled, getCourseProject, createCourseProject, getMyProjectSubmission, submitCourseProject, supabase, setSessionLive } from '@/lib/supabase'
import { sendPush } from '@/lib/push'
import { useAuth } from '@/context/AuthContext'
import { Clock, Users, Calendar, ChevronLeft, Loader2, AlertTriangle, FileText, Upload, CheckCircle, XCircle, RefreshCw, Plus, X, ImageIcon, Film, File } from 'lucide-react'
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

  // Project state
  const [project, setProject] = useState<any>(null)
  const [submission, setSubmission] = useState<any>(null)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [showSubmitProject, setShowSubmitProject] = useState(false)

  // Create project form
  const [projTitle, setProjTitle] = useState('')
  const [projDesc, setProjDesc] = useState('')
  const [projDue, setProjDue] = useState('')
  const [creatingProj, setCreatingProj] = useState(false)

  // Submit project form
  const [submitDesc, setSubmitDesc] = useState('')
  const [submitFile, setSubmitFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleCreateProject = async () => {
    if (!user || !projTitle.trim()) return
    setCreatingProj(true)
    const { data, error } = await createCourseProject(user.id, courseId as string, {
      title: projTitle.trim(),
      description: projDesc.trim() || undefined,
      due_date: projDue || undefined,
    })
    if (!error && data) {
      setProject(data)
      setShowCreateProject(false)
      setProjTitle(''); setProjDesc(''); setProjDue('')
    }
    setCreatingProj(false)
  }

  const handleSubmitProject = async () => {
    if (!user || !project) return
    setSubmitting(true)
    setSubmitError('')
    try {
      let fileUrl: string | undefined
      let fileType: string | undefined
      if (submitFile) {
        const ext = submitFile.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('project-files').upload(path, submitFile)
        if (upErr) throw new Error('File upload failed: ' + upErr.message)
        fileUrl = supabase.storage.from('project-files').getPublicUrl(path).data.publicUrl
        const mime = submitFile.type
        fileType = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'document'
      }
      const { data, error } = await submitCourseProject(user.id, project.id, courseId as string, {
        file_url: fileUrl,
        file_type: fileType,
        description: submitDesc.trim() || undefined,
      })
      if (error) throw new Error(error.message)
      setSubmission(data)
      setShowSubmitProject(false)
      setSubmitDesc(''); setSubmitFile(null)
    } catch (e: any) {
      setSubmitError(e.message || 'Submission failed. Try again.')
    } finally {
      setSubmitting(false)
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
  const completedCount = sessions.filter((s: any) => s.is_completed).length
  const almostDone = sessions.length > 0 && completedCount / sessions.length >= 0.7 && isInstructor && !project

  // Session routing helpers
  const nextSession   = sessions.find((s: any) => !s.is_completed)      // instructor: go live with this one
  const liveSession   = sessions.find((s: any) => s.is_live)            // student: join this one
  const instructorUrl = nextSession
    ? `/courses/${courseId}/classroom?sessionId=${nextSession.id}`
    : `/courses/${courseId}/classroom`
  const studentUrl = liveSession
    ? `/courses/${courseId}/classroom?sessionId=${liveSession.id}`
    : null

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

        {/* Instructor: almost-at-end alert */}
        {almostDone && (
          <div className="mb-5 bg-gradient-to-r from-[#FF6B2B]/10 to-[#C026D3]/10 border border-[#FF6B2B]/30 rounded-2xl px-4 py-4">
            <p className="text-white font-bold text-sm mb-1">Create your course project</p>
            <p className="text-[#888] text-xs mb-3">Let students showcase what they&apos;ve learned.</p>
            <button onClick={() => setShowCreateProject(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white text-xs font-bold px-4 py-2.5 rounded-xl">
              <Plus className="w-3.5 h-3.5" /> Create Project
            </button>
          </div>
        )}

        {/* ── PROJECT SECTION ─────────────────────────────── */}
        {project && (
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

            {/* Student submission */}
            {!isInstructor && enrolled && (
              <div>
                {submission ? (
                  <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]">
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
                    {submission.status === 'declined' && (
                      <button
                        onClick={() => { setSubmitDesc(submission.description || ''); setShowSubmitProject(true) }}
                        className="mt-3 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-3 rounded-xl text-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Try Again
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSubmitProject(true)}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-3.5 rounded-2xl text-sm"
                  >
                    <Upload className="w-4 h-4" /> Submit Your Project
                  </button>
                )}
              </div>
            )}

            {/* Instructor: view submissions */}
            {isInstructor && (
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-white font-bold py-3.5 rounded-2xl text-sm"
              >
                <Users className="w-4 h-4 text-[#888]" /> View Submissions Dashboard
              </Link>
            )}
          </div>
        )}

        {/* Instructor: add project (no alert shown) */}
        {isInstructor && !project && !almostDone && (
          <div className="border-t border-[rgba(255,255,255,0.07)] pt-6">
            <button
              onClick={() => setShowCreateProject(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-[rgba(255,255,255,0.15)] text-[#555] font-semibold py-3.5 rounded-2xl text-sm hover:text-white hover:border-[rgba(255,255,255,0.3)] transition"
            >
              <Plus className="w-4 h-4" /> Add Course Project
            </button>
          </div>
        )}

        {/* Spacer so content isn't hidden behind the fixed bottom button */}
        <div className="h-28" />
      </div>

      {/* STICKY ENROLL/JOIN BUTTON */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-[#0f0f0f] border-t border-[rgba(255,255,255,0.07)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        {isInstructor ? (
          <Link
            href={instructorUrl}
            className="block w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl text-center"
          >
            {liveSession ? 'Resume Live Class' : 'Start Live Class'}
          </Link>
        ) : enrolled ? (
          studentUrl ? (
            <Link
              href={studentUrl}
              className="block w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl text-center"
            >
              Enter Live Classroom
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

      {/* ── CREATE PROJECT MODAL ───────────────────────── */}
      {showCreateProject && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreateProject(false)} />
          <div className="relative bg-[#141414] rounded-t-3xl flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex justify-center pt-3 flex-shrink-0">
              <div className="w-10 h-1 bg-[#333] rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 pt-3 pb-4 flex-shrink-0 border-b border-[rgba(255,255,255,0.07)]">
              <h2 className="text-white text-lg font-bold">Create Course Project</h2>
              <button onClick={() => setShowCreateProject(false)} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div>
                <label className="block text-[#888] text-[11px] font-bold uppercase tracking-wider mb-2">Project Title</label>
                <input
                  value={projTitle}
                  onChange={e => setProjTitle(e.target.value)}
                  placeholder="e.g. Build a portfolio website"
                  className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition"
                />
              </div>
              <div>
                <label className="block text-[#888] text-[11px] font-bold uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={projDesc}
                  onChange={e => setProjDesc(e.target.value)}
                  placeholder="What should students submit? What criteria will you use?"
                  rows={4}
                  className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition resize-none"
                />
              </div>
              <div>
                <label className="block text-[#888] text-[11px] font-bold uppercase tracking-wider mb-2">Due Date (optional)</label>
                <input
                  type="date"
                  value={projDue}
                  onChange={e => setProjDue(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 text-white text-sm outline-none focus:border-[rgba(255,255,255,0.2)] transition"
                />
              </div>
            </div>
            <div className="flex-shrink-0 px-5 py-4 border-t border-[rgba(255,255,255,0.07)] bg-[#141414]"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
              <button
                onClick={handleCreateProject}
                disabled={!projTitle.trim() || creatingProj}
                className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {creatingProj ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMIT PROJECT MODAL ───────────────────────── */}
      {showSubmitProject && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSubmitProject(false)} />
          <div className="relative bg-[#141414] rounded-t-3xl flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex justify-center pt-3 flex-shrink-0">
              <div className="w-10 h-1 bg-[#333] rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 pt-3 pb-4 flex-shrink-0 border-b border-[rgba(255,255,255,0.07)]">
              <h2 className="text-white text-lg font-bold">Submit Project</h2>
              <button onClick={() => setShowSubmitProject(false)} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]">
                <p className="text-white font-bold text-sm">{project?.title}</p>
                {project?.description && <p className="text-[#555] text-xs mt-1 line-clamp-2">{project.description}</p>}
              </div>
              <div>
                <label className="block text-[#888] text-[11px] font-bold uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={submitDesc}
                  onChange={e => setSubmitDesc(e.target.value)}
                  placeholder="Describe your project, include links, or explain your approach…"
                  rows={4}
                  className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition resize-none"
                />
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] text-[#888] text-sm py-3.5 rounded-2xl hover:text-white transition"
              >
                {submitFile ? (
                  <>
                    {submitFile.type.startsWith('image/') ? <ImageIcon className="w-4 h-4" /> : submitFile.type.startsWith('video/') ? <Film className="w-4 h-4" /> : <File className="w-4 h-4" />}
                    <span className="truncate max-w-[200px]">{submitFile.name}</span>
                  </>
                ) : (
                  <><Upload className="w-4 h-4" /> Upload File, Photo or Video</>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx,.zip"
                onChange={e => setSubmitFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              {submitError && (
                <p className="text-red-400 text-xs text-center bg-red-400/10 rounded-xl px-3 py-2">{submitError}</p>
              )}
            </div>
            <div className="flex-shrink-0 px-5 py-4 border-t border-[rgba(255,255,255,0.07)] bg-[#141414]"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
              <button
                onClick={handleSubmitProject}
                disabled={submitting || (!submitDesc.trim() && !submitFile)}
                className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</> : 'Submit Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
