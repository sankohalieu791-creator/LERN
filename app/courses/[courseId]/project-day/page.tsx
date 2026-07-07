'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getCourseById, getCourseProjectBySession, getCourseProject,
  getProjectSubmissions, setSessionLive, gradeSubmission, supabase,
  getMyProjectShowcase, publishProjectShowcase, createVideo, notifyFollowers,
} from '@/lib/supabase'
import { sendPushToMany } from '@/lib/push'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, Upload, Film, ImageIcon, File, CheckCircle,
  XCircle, Clock, Calendar, Users, MessageSquare, X, Plus, RefreshCw,
  ClipboardList, Video, Pencil, Globe, Lock, Trophy,
} from 'lucide-react'

function StatusBadge({ status }: { status: string }) {
  if (status === 'accepted') return (
    <span className="flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 text-green-400 text-[10px] font-bold px-2.5 py-1 rounded-full">
      <CheckCircle className="w-3 h-3" /> Accepted
    </span>
  )
  if (status === 'declined') return (
    <span className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded-full">
      <XCircle className="w-3 h-3" /> Needs Work
    </span>
  )
  return (
    <span className="flex items-center gap-1.5 bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold px-2.5 py-1 rounded-full">
      <Clock className="w-3 h-3" /> Pending Review
    </span>
  )
}

function ProjectDayInner() {
  const { courseId } = useParams<{ courseId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')

  const [course,       setCourse]       = useState<any>(null)
  const [session,      setSession]      = useState<any>(null)
  const [project,      setProject]      = useState<any>(null)
  const [submissions,  setSubmissions]  = useState<any[]>([])
  const [mySubmission, setMySubmission] = useState<any>(null)
  const [loading,      setLoading]      = useState(true)
  const [enrolled,     setEnrolled]     = useState(false)

  // Create project (instructor — shown when no project exists)
  const [showCreate,   setShowCreate]   = useState(false)
  const [projTitle,    setProjTitle]    = useState('')
  const [projDesc,     setProjDesc]     = useState('')
  const [projDue,      setProjDue]      = useState('')
  const [projMode,     setProjMode]     = useState<'upload' | 'live' | 'both'>('upload')
  const [creating,     setCreating]     = useState(false)

  // Student submission
  const [submitDesc,   setSubmitDesc]   = useState('')
  const [submitFile,   setSubmitFile]   = useState<File | null>(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Instructor grading
  const [gradingId,    setGradingId]    = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [grading,      setGrading]      = useState(false)

  // Closing project day
  const [closing,      setClosing]      = useState(false)

  // Student: publishing an accepted project
  const [showcase,     setShowcase]     = useState<any>(null)
  const [publishing,   setPublishing]   = useState<'public' | 'private' | null>(null)
  const [publishError, setPublishError] = useState('')

  const openedRef = useRef(false)

  // ── Load ─────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: courseData } = await getCourseById(courseId)
      if (!courseData) { setLoading(false); return }
      setCourse(courseData)

      const sessions: any[] = courseData.course_sessions ?? []
      const s = sessionId ? sessions.find((x: any) => x.id === sessionId) : null
      setSession(s ?? null)

      // Check enrollment
      if (user) {
        const { data: enr } = await supabase
          .from('enrollments').select('id').eq('course_id', courseId).eq('user_id', user.id).maybeSingle()
        setEnrolled(!!enr)
      }

      // Find project: first by session_id, then by course_id (legacy)
      let proj: any = null
      if (sessionId) {
        const { data } = await getCourseProjectBySession(sessionId)
        proj = data
      }
      if (!proj) {
        const { data } = await getCourseProject(courseId)
        proj = data
      }
      setProject(proj)

      if (proj && user) {
        const isInstructor = user.id === courseData.instructor_id
        if (isInstructor) {
          const { data: subs } = await getProjectSubmissions(proj.id)
          setSubmissions(subs ?? [])
        } else {
          const { data: sub } = await supabase
            .from('project_submissions')
            .select('*')
            .eq('project_id', proj.id)
            .eq('user_id', user.id)
            .maybeSingle()
          setMySubmission(sub)
          setShowcase(await getMyProjectShowcase(user.id, courseId))
        }
      }

      setLoading(false)
    }
    load()
  }, [courseId, sessionId, user])

  // ── Instructor: open project day ──────────────────────────────
  useEffect(() => {
    if (!course || !user || !sessionId || openedRef.current) return
    if (user.id !== course.instructor_id) return
    openedRef.current = true

    setSessionLive(sessionId, true).then(async ({ error }) => {
      if (error) return
      setSession((prev: any) => prev ? { ...prev, is_live: true } : prev)

      const { data: rows } = await supabase
        .from('enrollments').select('user_id').eq('course_id', courseId)
      const ids = (rows ?? []).map((r: any) => r.user_id).filter((id: string) => id !== user.id)
      if (!ids.length) return

      sendPushToMany(
        ids,
        '📋 Project Day is open!',
        `${course.title} — submit your project now`,
        `/courses/${courseId}/project-day?sessionId=${sessionId}`
      )

      await supabase.from('notifications').insert(
        ids.map((studentId: string) => ({
          user_id:           studentId,
          type:              'project_day',
          title:             '📋 Project Day is open!',
          body:              `${course.title} — submit your project now`,
          link:              `/courses/${courseId}/project-day?sessionId=${sessionId}`,
          sender_id:         user.id,
          sender_username:   (user as any).username ?? '',
          sender_avatar_url: (user as any).avatar_url ?? null,
        }))
      )
    })
  }, [course, user, session, sessionId, courseId])

  // ── Realtime: new submissions (instructor view) ───────────────
  useEffect(() => {
    if (!project || !user || !course) return
    if (user.id !== course.instructor_id) return
    const channel = supabase
      .channel(`pd-subs-${project.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'project_submissions',
        filter: `project_id=eq.${project.id}`,
      }, async (payload: any) => {
        const { data: u } = await supabase
          .from('users').select('id, username, avatar_url').eq('id', payload.new.user_id).maybeSingle()
        setSubmissions(prev => [{ ...payload.new, user: u }, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [project, user, course])

  // ── Realtime: session live state (student gate) ───────────────
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`pd-session-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'course_sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload: any) => {
        setSession((prev: any) => prev ? { ...prev, ...payload.new } : prev)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  // ── Handlers ─────────────────────────────────────────────────
  const handleCreateProject = async () => {
    if (!user || !projTitle.trim()) return
    setCreating(true)
    const { data: courseRow } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .maybeSingle()

    const { data, error } = await supabase
      .from('course_projects')
      .insert([{
        instructor_id:   user.id,
        ...(courseRow?.id ? { course_id: courseRow.id } : {}),
        session_id:      sessionId,
        title:           projTitle.trim(),
        description:     projDesc.trim() || null,
        due_date:        projDue || null,
        submission_mode: projMode,
      }])
      .select().single()
    if (!error && data) {
      setProject(data)
      setShowCreate(false)
      setProjTitle(''); setProjDesc(''); setProjDue('')
    }
    setCreating(false)
  }

  const handleSubmit = async () => {
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
        if (upErr) throw new Error('Upload failed: ' + upErr.message)
        fileUrl = supabase.storage.from('project-files').getPublicUrl(path).data.publicUrl
        const mime = submitFile.type
        fileType = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'document'
      }
      const { data: courseRow } = await supabase
        .from('courses')
        .select('id')
        .eq('id', courseId)
        .maybeSingle()

      const { data, error } = await supabase
        .from('project_submissions')
        .upsert([{
          user_id:     user.id,
          project_id:  project.id,
          ...(courseRow?.id ? { course_id: courseRow.id } : {}),
          session_id:  sessionId,
          status:      'pending',
          file_url:    fileUrl,
          file_type:   fileType,
          description: submitDesc.trim() || null,
        }], { onConflict: 'project_id,user_id' })
        .select().single()
      if (error) throw new Error(error.message)
      setMySubmission(data)
      setSubmitDesc(''); setSubmitFile(null)
    } catch (e: any) {
      setSubmitError(e.message || 'Submission failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePublish = async (visibility: 'public' | 'private') => {
    if (!user || !project || !mySubmission) return
    setPublishing(visibility)
    setPublishError('')
    try {
      const { data, error } = await publishProjectShowcase(user.id, {
        course_id:       courseId,
        title:           project.title,
        description:     mySubmission.description || project.description || undefined,
        visibility,
        attachment_url:  mySubmission.file_url || undefined,
        attachment_type: mySubmission.file_type || undefined,
      })
      if (error) throw new Error(error.message)

      // Public projects also appear in the main feed as a post
      if (visibility === 'public') {
        const { data: videoData } = await createVideo(user.id, {
          title:         project.title,
          description:   mySubmission.description || project.description || '',
          subject:       course.subject || 'project',
          duration:      '',
          thumbnail_url: mySubmission.file_type === 'image' ? mySubmission.file_url : null,
          video_url:     mySubmission.file_type === 'video' ? mySubmission.file_url : null,
          views:         0,
          is_public:     true,
        })
        const newVideoId = (videoData as any)?.[0]?.id
        notifyFollowers(
          user.id,
          'new_course',
          '🏆 New project',
          `${(user as any).username ?? 'Someone'} published: ${project.title}`,
          newVideoId ? `/feed/${newVideoId}` : `/courses/${courseId}`,
          { id: user.id, username: (user as any).username ?? '', avatar_url: (user as any).avatar_url ?? null }
        )
      }
      setShowcase(data ?? { visibility })
    } catch (e: any) {
      setPublishError(e.message || 'Could not publish. Try again.')
    } finally {
      setPublishing(null)
    }
  }

  const handleGrade = async (submissionId: string, status: 'accepted' | 'declined') => {
    setGrading(true)
    const { data } = await gradeSubmission(submissionId, status, feedbackText.trim() || undefined)
    if (data) {
      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, ...data } : s))
      setGradingId(null)
      setFeedbackText('')
    }
    setGrading(false)
  }

  const handleClose = async () => {
    if (!sessionId) return
    setClosing(true)
    await supabase
      .from('course_sessions')
      .update({ is_live: false, is_completed: true })
      .eq('id', sessionId)
    setClosing(false)
    router.back()
  }

  // ── Loading ───────────────────────────────────────────────────
  if (loading) return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
    </div>
  )
  if (!course) return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-[#555]">Course not found</p>
    </div>
  )

  const isInstructor = !!(user && user.id === course.instructor_id)
  const mode = project?.submission_mode ?? 'upload'
  const reviewed  = submissions.filter(s => s.status !== 'pending').length
  const classroomUrl = `/courses/${courseId}/classroom?sessionId=${sessionId}`

  // Project Day stays locked for students until EVERY taught session is complete
  // (i.e. the final class of the course has finished) — going live early no longer
  // unlocks it.
  const allSessions     = (course.course_sessions ?? []) as any[]
  const teachingSessions = allSessions.filter(s => !s.is_project_day)
  const teachingDone    = teachingSessions.length > 0
    ? teachingSessions.every(s => s.is_completed)
    : allSessions.every(s => s.is_completed)
  const projectOpen     = !!(session?.is_completed || teachingDone)

  // Student gate: project day not open yet
  if (!isInstructor && session && !projectOpen) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center px-8 gap-5"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="w-20 h-20 rounded-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] flex items-center justify-center text-4xl">
          📋
        </div>
        <div className="text-center">
          <p className="text-[#FF6B2B] text-xs font-bold uppercase tracking-[0.2em] mb-2">Not Open Yet</p>
          <p className="text-white font-bold text-lg mb-1">{course.title}</p>
          <p className="text-[#555] text-sm">Project Day — waiting for your instructor to open submissions</p>
        </div>
        <button onClick={() => router.back()} className="text-[#555] text-sm mt-2">← Back to course</button>
      </div>
    )
  }

  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-[#0a0a0a] overflow-y-auto">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-[rgba(255,255,255,0.06)]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 bg-[#1a1a1a] rounded-full flex items-center justify-center flex-shrink-0">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[#FF6B2B] text-[10px] font-bold uppercase tracking-[0.2em]">Project Day</p>
            <h1 className="text-white font-bold text-sm leading-tight truncate">{course.title}</h1>
          </div>
          {isInstructor && (
            <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-full px-3 py-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-[#FF6B2B]" />
              <span className="text-white text-xs font-bold">{reviewed}/{submissions.length}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 pb-32 space-y-5">

        {/* ── PROJECT BRIEF ────────────────────────────────────── */}
        {project ? (
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#161616] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="text-white font-bold text-base leading-snug flex-1">{project.title}</h2>
              {isInstructor && (
                <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border
                  border-[rgba(255,255,255,0.12)] text-[#888]">
                  {mode === 'upload' ? '📤 Upload' : mode === 'live' ? '🎥 Live Demo' : '📤 Upload + 🎥 Live'}
                </span>
              )}
            </div>
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
        ) : isInstructor ? (
          // Instructor: no project yet — prompt to create
          <div className="bg-gradient-to-r from-[#FF6B2B]/10 to-[#C026D3]/10 border border-[#FF6B2B]/30 rounded-2xl p-4">
            <p className="text-white font-bold text-sm mb-1">Set the project brief</p>
            <p className="text-[#888] text-xs mb-3">Tell students what to submit for Project Day.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white text-xs font-bold px-4 py-2.5 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" /> Create Project Brief
            </button>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4 text-center">
            <p className="text-[#555] text-sm">Project brief coming soon…</p>
          </div>
        )}

        {/* ── LIVE DEMO BUTTON ──────────────────────────────────── */}
        {(mode === 'live' || mode === 'both') && (
          <Link
            href={classroomUrl}
            className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl"
          >
            <Video className="w-4 h-4" />
            {isInstructor ? 'Start / Join Live Demo Session' : 'Join Live Demo Session'}
          </Link>
        )}

        {/* ══ INSTRUCTOR: SUBMISSIONS ════════════════════════════ */}
        {isInstructor && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[#FF6B2B]" />
              <p className="text-white text-sm font-bold uppercase tracking-wide">
                Submissions
                {submissions.length > 0 && (
                  <span className="ml-2 text-[#555] font-normal normal-case text-xs">
                    {reviewed} reviewed · {submissions.length - reviewed} pending
                  </span>
                )}
              </p>
            </div>

            {submissions.length === 0 ? (
              <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 text-center">
                <p className="text-[#555] text-sm">No submissions yet — students will appear here in real time</p>
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map(sub => (
                  <div key={sub.id} className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden">
                    {/* Student row */}
                    <div className="flex items-center gap-3 p-4">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
                        {sub.user?.avatar_url
                          ? <img src={sub.user.avatar_url} className="w-full h-full object-cover" alt="" />
                          : (sub.user?.username?.[0] ?? '?').toUpperCase()
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-bold truncate">{sub.user?.username ?? 'Student'}</p>
                        {sub.description && (
                          <p className="text-[#555] text-xs truncate mt-0.5">{sub.description}</p>
                        )}
                      </div>
                      <StatusBadge status={sub.status} />
                    </div>

                    {/* File / media */}
                    {sub.file_url && (
                      <div className="px-4 pb-3">
                        {sub.file_type === 'video' ? (
                          <video
                            src={sub.file_url}
                            controls
                            className="w-full rounded-xl max-h-48 bg-black"
                          />
                        ) : sub.file_type === 'image' ? (
                          <img src={sub.file_url} alt="submission" className="w-full rounded-xl max-h-48 object-cover" />
                        ) : (
                          <a href={sub.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-[#1d9bf0] text-xs font-semibold">
                            <File className="w-3.5 h-3.5" /> View submitted file
                          </a>
                        )}
                      </div>
                    )}

                    {/* Instructor feedback display */}
                    {sub.feedback && sub.status !== 'pending' && (
                      <div className="mx-4 mb-3 bg-[#111] rounded-xl p-3 border border-[rgba(255,255,255,0.05)]">
                        <p className="text-[#555] text-[10px] font-bold uppercase tracking-wider mb-1">Your Feedback</p>
                        <p className="text-[#888] text-xs">{sub.feedback}</p>
                      </div>
                    )}

                    {/* Grade panel */}
                    {sub.status === 'pending' && gradingId !== sub.id && (
                      <div className="flex gap-2 px-4 pb-4">
                        <button
                          onClick={() => { setGradingId(sub.id); setFeedbackText('') }}
                          className="flex items-center gap-1.5 text-[#888] border border-[rgba(255,255,255,0.08)] text-xs font-semibold px-3 py-2 rounded-xl hover:text-white transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Review
                        </button>
                        <button
                          onClick={() => handleGrade(sub.id, 'accepted')}
                          disabled={grading}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold py-2 rounded-xl hover:bg-green-500/25 transition disabled:opacity-40"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          onClick={() => handleGrade(sub.id, 'declined')}
                          disabled={grading}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold py-2 rounded-xl hover:bg-red-500/25 transition disabled:opacity-40"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Decline
                        </button>
                      </div>
                    )}

                    {/* Re-grade already graded */}
                    {sub.status !== 'pending' && gradingId !== sub.id && (
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => { setGradingId(sub.id); setFeedbackText(sub.feedback ?? '') }}
                          className="flex items-center gap-1.5 text-[#555] text-xs font-semibold"
                        >
                          <Pencil className="w-3 h-3" /> Update grade
                        </button>
                      </div>
                    )}

                    {/* Grading panel open */}
                    {gradingId === sub.id && (
                      <div className="px-4 pb-4 space-y-3">
                        <textarea
                          value={feedbackText}
                          onChange={e => setFeedbackText(e.target.value)}
                          placeholder="Optional feedback to the student…"
                          rows={3}
                          className="w-full bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition resize-none"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => { setGradingId(null); setFeedbackText('') }}
                            className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center flex-shrink-0">
                            <X className="w-3.5 h-3.5 text-[#888]" />
                          </button>
                          <button
                            onClick={() => handleGrade(sub.id, 'accepted')}
                            disabled={grading}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold py-2.5 rounded-xl disabled:opacity-40"
                          >
                            {grading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            Accept
                          </button>
                          <button
                            onClick={() => handleGrade(sub.id, 'declined')}
                            disabled={grading}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold py-2.5 rounded-xl disabled:opacity-40"
                          >
                            {grading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                            Decline
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ STUDENT: SUBMISSION ════════════════════════════════ */}
        {!isInstructor && enrolled && project && (mode === 'upload' || mode === 'both') && (
          <div>
            <p className="text-white text-base font-bold mb-3">Submit Your Project</p>

            {mySubmission && mySubmission.status !== 'declined' ? (
              // Already submitted — show status card
              <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-white font-bold text-sm">Your submission</p>
                  <StatusBadge status={mySubmission.status} />
                </div>
                {mySubmission.description && (
                  <p className="text-[#888] text-sm">{mySubmission.description}</p>
                )}
                {mySubmission.file_url && (
                  mySubmission.file_type === 'video' ? (
                    <video src={mySubmission.file_url} controls className="w-full rounded-xl max-h-48 bg-black" />
                  ) : mySubmission.file_type === 'image' ? (
                    <img src={mySubmission.file_url} alt="submission" className="w-full rounded-xl max-h-48 object-cover" />
                  ) : (
                    <a href={mySubmission.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-[#111] rounded-xl px-4 py-3 text-[#1d9bf0] text-sm font-semibold">
                      <File className="w-4 h-4" /> View submitted file
                    </a>
                  )
                )}
                {mySubmission.feedback && (
                  <div className="bg-[#111] rounded-xl p-3 border border-[rgba(255,255,255,0.06)]">
                    <p className="text-[#555] text-[10px] font-bold uppercase tracking-wider mb-1">Instructor Feedback</p>
                    <p className="text-[#888] text-sm">{mySubmission.feedback}</p>
                  </div>
                )}

                {/* Accepted → publish to feed or keep private */}
                {mySubmission.status === 'accepted' && (
                  <div className="border-t border-[rgba(255,255,255,0.07)] pt-4 mt-1">
                    {showcase ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Trophy className="w-4 h-4 text-[#FF6B2B]" />
                        <span className="text-white font-semibold">
                          {showcase.visibility === 'public' ? 'Published to your feed' : 'Saved to your private showcase'}
                        </span>
                        {showcase.visibility === 'public'
                          ? <Globe className="w-3.5 h-3.5 text-[#555] ml-auto" />
                          : <Lock className="w-3.5 h-3.5 text-[#555] ml-auto" />}
                      </div>
                    ) : (
                      <>
                        <p className="text-white font-bold text-sm mb-1 flex items-center gap-1.5">
                          <Trophy className="w-4 h-4 text-[#FF6B2B]" /> Showcase your project
                        </p>
                        <p className="text-[#555] text-xs mb-3">Your instructor accepted it — publish it publicly or keep it visible to instructors &amp; employers only.</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handlePublish('public')}
                            disabled={!!publishing}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white text-sm font-bold py-3 rounded-xl disabled:opacity-40"
                          >
                            {publishing === 'public' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                            Post to Feed
                          </button>
                          <button
                            onClick={() => handlePublish('private')}
                            disabled={!!publishing}
                            className="flex items-center justify-center gap-2 bg-[#1e1e1e] border border-[rgba(255,255,255,0.1)] text-white text-sm font-bold py-3 rounded-xl disabled:opacity-40"
                          >
                            {publishing === 'private' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                            Keep Private
                          </button>
                        </div>
                        {publishError && (
                          <p className="text-red-400 text-xs bg-red-400/10 rounded-xl px-3 py-2 text-center mt-2">{publishError}</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Submission form
              <div className="space-y-3">
                {/* Declined banner */}
                {mySubmission?.status === 'declined' && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3">
                    <p className="text-red-400 text-sm font-bold mb-0.5">Needs revision</p>
                    {mySubmission.feedback && <p className="text-[#888] text-xs">{mySubmission.feedback}</p>}
                  </div>
                )}

                {/* Selected file preview */}
                {submitFile && (
                  <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-2xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#111] flex items-center justify-center flex-shrink-0">
                      {submitFile.type.startsWith('image/') ? <ImageIcon className="w-5 h-5 text-[#FF6B2B]" />
                        : submitFile.type.startsWith('video/') ? <Film className="w-5 h-5 text-[#FF6B2B]" />
                        : <File className="w-5 h-5 text-[#FF6B2B]" />}
                    </div>
                    <p className="text-white text-sm font-semibold flex-1 truncate">{submitFile.name}</p>
                    <button onClick={() => setSubmitFile(null)}>
                      <X className="w-4 h-4 text-[#555]" />
                    </button>
                  </div>
                )}

                {/* Upload options */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Upload PDF */}
                  <button
                    type="button"
                    onClick={() => {
                      const inp = document.createElement('input')
                      inp.type = 'file'; inp.accept = '.pdf,.doc,.docx'
                      inp.onchange = e => setSubmitFile((e.target as HTMLInputElement).files?.[0] || null)
                      inp.click()
                    }}
                    className="flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-2xl py-5 active:opacity-70 transition"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#FF6B2B]/15 flex items-center justify-center">
                      <File className="w-6 h-6 text-[#FF6B2B]" />
                    </div>
                    <p className="text-white text-sm font-bold">Upload PDF</p>
                    <p className="text-[#555] text-[11px]">PDF, Word doc</p>
                  </button>

                  {/* Take / upload a photo */}
                  <button
                    type="button"
                    onClick={() => {
                      const inp = document.createElement('input')
                      inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment'
                      inp.onchange = e => setSubmitFile((e.target as HTMLInputElement).files?.[0] || null)
                      inp.click()
                    }}
                    className="flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-2xl py-5 active:opacity-70 transition"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#C026D3]/15 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-[#C026D3]" />
                    </div>
                    <p className="text-white text-sm font-bold">Take a Photo</p>
                    <p className="text-[#555] text-[11px]">Camera or gallery</p>
                  </button>
                </div>

                {/* Notes */}
                <textarea
                  value={submitDesc}
                  onChange={e => setSubmitDesc(e.target.value)}
                  placeholder="Add a note for your instructor — what you did, what you found challenging…"
                  rows={3}
                  className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition resize-none"
                />

                {submitError && (
                  <p className="text-red-400 text-xs bg-red-400/10 rounded-xl px-3 py-2 text-center">{submitError}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || (!submitDesc.trim() && !submitFile)}
                  className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    : <><Upload className="w-4 h-4" /> Submit Project</>
                  }
                </button>
              </div>
            )}
          </div>
        )}

        {/* Not enrolled notice */}
        {!isInstructor && !enrolled && (
          <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4 text-center">
            <p className="text-[#555] text-sm">Enroll in this course to submit your project</p>
          </div>
        )}
      </div>

      {/* ── STICKY BOTTOM (instructor) ────────────────────────── */}
      {isInstructor && (
        <div className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-[rgba(255,255,255,0.07)]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <button
            onClick={handleClose}
            disabled={closing}
            className="w-full flex items-center justify-center gap-2 border border-red-500/30 text-red-400 font-bold py-4 rounded-2xl text-sm hover:bg-red-500/10 transition disabled:opacity-40"
          >
            {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Close Project Day & Mark Complete
          </button>
        </div>
      )}

      {/* ── CREATE PROJECT BRIEF MODAL ───────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-[#141414] rounded-t-3xl flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="flex justify-center pt-3 flex-shrink-0">
              <div className="w-10 h-1 bg-[#333] rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 pt-3 pb-4 flex-shrink-0 border-b border-[rgba(255,255,255,0.07)]">
              <h2 className="text-white text-lg font-bold">Project Brief</h2>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div>
                <label className="block text-[#888] text-[11px] font-bold uppercase tracking-wider mb-2">Project Title</label>
                <input
                  value={projTitle}
                  onChange={e => setProjTitle(e.target.value)}
                  placeholder="e.g. Demonstrate patient assessment technique"
                  className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition"
                />
              </div>
              <div>
                <label className="block text-[#888] text-[11px] font-bold uppercase tracking-wider mb-2">Instructions</label>
                <textarea
                  value={projDesc}
                  onChange={e => setProjDesc(e.target.value)}
                  placeholder="What should students do? What criteria will you grade on?"
                  rows={4}
                  className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition resize-none"
                />
              </div>
              <div>
                <label className="block text-[#888] text-[11px] font-bold uppercase tracking-wider mb-2">Submission Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['upload', 'live', 'both'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setProjMode(m)}
                      className={`py-3 rounded-xl border text-xs font-bold transition ${
                        projMode === m
                          ? 'border-[#FF6B2B] bg-[#FF6B2B]/15 text-[#FF6B2B]'
                          : 'border-[rgba(255,255,255,0.08)] text-[#555] bg-[#1e1e1e]'
                      }`}
                    >
                      {m === 'upload' ? '📤 Upload' : m === 'live' ? '🎥 Live Demo' : '📤 + 🎥 Both'}
                    </button>
                  ))}
                </div>
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
                disabled={!projTitle.trim() || creating}
                className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Publish Project Brief'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProjectDayPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
      </div>
    }>
      <ProjectDayInner />
    </Suspense>
  )
}
