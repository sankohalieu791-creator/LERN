'use client'

import { useState, useEffect } from 'react'
import {
  SlidersHorizontal, Star, Clock, Users, X, Check,
  Calendar, Loader2, Lock,
  UserCheck, Plus, BookOpen, Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getCourses, getWorkshops, getCourseById, enrollCourse,
  isEnrolled, rateCourse, getUserCourseRating,
  joinWorkshop, leaveWorkshop, getMyWorkshopJoins,
  setSessionLive, getEnrolledCourses,
} from '@/lib/supabase'
import CreateCourse from '@/components/CreateCourse'
import CreateWorkshop from '@/components/CreateWorkshop'

function VerifiedBadge({ size = 12 }: { size?: number }) {
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

const LEVELS = ['beginner','intermediate','advanced']
type Tab = 'courses' | 'workshops' | 'enrolled'

// ── Enrolled course card ──────────────────────────────────────
function EnrolledCourseCard({ course, onJoin }: { course: any; onJoin: () => void }) {
  const sessions = ((course.course_sessions || []) as any[])
    .slice()
    .sort((a, b) => (a.session_number ?? 999) - (b.session_number ?? 999))

  const firstSession = sessions[0]
  const isLive = sessions.some(s => s.is_live)

  const startDateStr = firstSession?.session_date
    ? new Date(firstSession.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.06)]">
      <div className="aspect-video relative bg-[#252525]">
        {course.thumbnail_url
          ? <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] flex items-center justify-center">
              {isLive
                ? <span className="text-white text-xs font-bold bg-red-500 px-3 py-1 rounded-full animate-pulse">LIVE NOW</span>
                : <Lock className="w-8 h-8 text-white/20" />
              }
            </div>
        }
        {isLive && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse inline-block" />
            LIVE
          </span>
        )}
        {!isLive && startDateStr && (
          <div className="absolute top-2 left-2 bg-black/70 rounded-xl px-2 py-1 text-center">
            <p className="text-[#888] text-[9px] font-bold uppercase">Starts</p>
            <p className="text-white text-xs font-bold">{startDateStr}</p>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-white font-bold text-sm leading-snug mb-2 line-clamp-2">{course.title}</h3>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] overflow-hidden flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {course.users?.avatar_url
              ? <img src={course.users.avatar_url} className="w-full h-full object-cover" />
              : course.users?.username?.[0]}
          </div>
          <span className="text-[#666] text-xs font-semibold flex items-center gap-1">
            {course.users?.username}
            {course.users?.verified && <VerifiedBadge size={10} />}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[#555] text-xs">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.duration_weeks}w</span>
            {startDateStr && !isLive && (
              <span className="flex items-center gap-1 text-[#444]">
                <Lock className="w-3 h-3" />Locked
              </span>
            )}
          </div>
          {isLive ? (
            <button onClick={onJoin} className="bg-red-500 text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              Join Now
            </button>
          ) : (
            <span className="bg-[#1a1a1a] text-[#555] text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5 border border-[rgba(255,255,255,0.06)]">
              <Lock className="w-3 h-3" />
              {startDateStr ? `Starts ${startDateStr}` : 'Coming Soon'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Course detail bottom sheet ────────────────────────────────
function CourseDetailSheet({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const { user } = useAuth()
  const router   = useRouter()
  const [course,     setCourse]     = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [enrolled,   setEnrolled]   = useState(false)
  const [enrolling,  setEnrolling]  = useState(false)
  const [success,    setSuccess]    = useState(false)
  const [starting,   setStarting]   = useState(false)
  const [userRating, setUserRating] = useState(0)
  const [ratingDone, setRatingDone] = useState(false)

  const isOwner = !!(user && course && user.id === course.instructor_id)

  useEffect(() => {
    const load = async () => {
      const { data } = await getCourseById(courseId)
      setCourse(data)
      if (user) {
        const [{ data: enrolledData }, { data: ratingData }] = await Promise.all([
          isEnrolled(courseId, user.id),
          getUserCourseRating(courseId, user.id),
        ])
        setEnrolled(!!enrolledData)
        if (ratingData?.rating) { setUserRating(ratingData.rating); setRatingDone(true) }
      }
      setLoading(false)
    }
    load()
  }, [courseId, user])

  const handleEnroll = async () => {
    if (!user) { router.push('/auth/login'); return }
    setEnrolling(true)
    await enrollCourse(courseId, user.id)
    setEnrolled(true)
    setSuccess(true)
    setEnrolling(false)
    setTimeout(() => setSuccess(false), 2000)
  }

  const handleStartClass = async () => {
    setStarting(true)
    const sessions = course?.course_sessions?.slice().sort((a: any, b: any) => (a.session_number ?? 999) - (b.session_number ?? 999)) ?? []
    const nextSession = sessions.find((s: any) => !s.is_live && !s.is_project_day)
    if (nextSession) {
      await setSessionLive(nextSession.id, true)
    }
    setStarting(false)
    router.push(`/courses/${courseId}/classroom`)
  }

  const handleRate = async (stars: number) => {
    if (!user || !enrolled) return
    setUserRating(stars)
    setRatingDone(true)
    await rateCourse(courseId, user.id, stars)
    const { data } = await getCourseById(courseId)
    setCourse(data)
  }

  const sessions = course?.course_sessions?.slice().sort((a: any, b: any) =>
    new Date(a.session_date || 0).getTime() - new Date(b.session_date || 0).getTime()
  ) ?? []

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#141414] rounded-t-3xl flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="flex justify-center pt-3 flex-shrink-0">
          <div className="w-10 h-1 bg-[#333] rounded-full" />
        </div>
        <div className="flex justify-end px-4 pt-2 pb-1 flex-shrink-0">
          <button onClick={onClose} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
              <h2 className="text-white text-xl font-bold leading-snug mb-3">{course?.title}</h2>

              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
                  {course?.users?.avatar_url
                    ? <img src={course.users.avatar_url} className="w-full h-full object-cover" />
                    : course?.users?.username?.[0]?.toUpperCase()
                  }
                </div>
                <p className="text-white text-sm font-semibold flex items-center gap-1.5">
                  {course?.users?.username}
                  {course?.users?.verified && <VerifiedBadge size={13} />}
                </p>
              </div>

              <p className="text-[#888] text-sm leading-relaxed mb-4">{course?.description}</p>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4 text-sm text-[#888]">
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{course?.duration_weeks}w</span>
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{(course?.enrolled_count || 0).toLocaleString()}</span>
                  <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />{course?.rating?.toFixed(1)}</span>
                </div>
                <span className="text-xs font-bold border border-[rgba(255,255,255,0.15)] text-[#888] px-3 py-1 rounded-full capitalize">{course?.level}</span>
              </div>

              {sessions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#FF6B2B]" />
                      <p className="text-white text-sm font-bold uppercase tracking-wide">Your Timetable</p>
                    </div>
                    <span className="text-[#555] text-xs">{sessions.length} sessions</span>
                  </div>
                  <div className="space-y-2">
                    {sessions.map((s: any) => {
                      const d = s.session_date ? new Date(s.session_date) : null
                      const mon = d?.toLocaleString('default', { month: 'short' }).toUpperCase()
                      const day = d?.getDate()
                      return (
                        <div key={s.id} className="flex items-center gap-3 bg-[#1e1e1e] rounded-2xl px-4 py-3">
                          <div className="flex-shrink-0 w-12 text-center">
                            {d ? (
                              <>
                                <p className="text-[#555] text-[9px] font-bold">{mon}</p>
                                <p className="text-white font-bold text-xl leading-none">{day}</p>
                              </>
                            ) : (
                              <p className="text-white font-bold text-xl leading-none">{s.session_number}</p>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold truncate">{s.title}</p>
                            <p className="text-[#555] text-xs mt-0.5">
                              {d?.toLocaleString('default', { weekday: 'short' })}
                              {s.session_time && ` ${s.session_time.slice(0, 5)}`}
                              {' · 60 min'}
                            </p>
                          </div>
                          {s.is_project_day && (
                            <span className="text-[9px] font-bold bg-red-500 text-white px-2 py-1 rounded-full flex-shrink-0">PROJECTS DAY</span>
                          )}
                          {s.is_live && (
                            <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 animate-pulse" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {enrolled && !isOwner && (
                <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.07)]">
                  <p className="text-[#555] text-[11px] font-bold uppercase tracking-widest mb-3">
                    {ratingDone ? 'Your rating' : 'Rate this course'}
                  </p>
                  <div className="flex gap-3">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => handleRate(n)}
                        className="flex-1 flex items-center justify-center transition active:scale-90">
                        <Star className={`w-7 h-7 ${n <= userRating ? 'fill-yellow-400 text-yellow-400' : 'text-[#333]'}`} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 px-5 py-4 border-t border-[rgba(255,255,255,0.07)] bg-[#141414]"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
              {isOwner ? (
                <button
                  onClick={handleStartClass}
                  disabled={starting}
                  className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {starting ? <><Loader2 className="w-4 h-4 animate-spin" />Starting…</> : '🔴 Start Class'}
                </button>
              ) : enrolled ? (
                <div className="space-y-2">
                  <div className="bg-green-500/10 border border-green-500/25 rounded-2xl px-4 py-3 text-center">
                    <p className="text-green-400 font-bold text-sm">✓ You're enrolled!</p>
                    <p className="text-green-400/70 text-xs mt-0.5">Check the Enrolled tab to join live classes</p>
                  </div>
                  <button
                    onClick={() => { onClose(); setTimeout(() => { const el = document.querySelector('[data-tab="enrolled"]') as HTMLElement; el?.click() }, 100) }}
                    className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-3.5 rounded-2xl"
                  >
                    View Timetable →
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {enrolling ? <><Loader2 className="w-4 h-4 animate-spin" />Enrolling…</> : success ? '✓ Enrolled!' : 'Enroll'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function CoursesPage() {
  const { user } = useAuth()
  const router   = useRouter()
  const [activeTab,       setActiveTab]       = useState<Tab>('courses')
  const [courses,         setCourses]         = useState<any[]>([])
  const [workshops,       setWorkshops]       = useState<any[]>([])
  const [enrolled,        setEnrolled]        = useState<any[]>([])
  const [loading,         setLoading]         = useState(true)
  const [showFilter,      setShowFilter]      = useState(false)
  const [filterLevel,     setFilterLevel]     = useState('')
  const [filterSubject,   setFilterSubject]   = useState('')
  const [allSubjects,     setAllSubjects]     = useState<string[]>([])
  const [detailCourseId,  setDetailCourseId]  = useState<string | null>(null)
  const [joinedWorkshops, setJoinedWorkshops] = useState<Set<string>>(new Set())
  const [joiningId,       setJoiningId]       = useState<string | null>(null)
  const [showCreateCourse,   setShowCreateCourse]   = useState(false)
  const [showCreateWorkshop, setShowCreateWorkshop] = useState(false)
  const [showCreateMenu,     setShowCreateMenu]     = useState(false)
  const isInstructor = user?.account_type === 'instructor'

  useEffect(() => {
    const load = async () => {
      const [{ data: c }, { data: w }] = await Promise.all([getCourses(), getWorkshops()])
      setCourses(c || [])
      setWorkshops(w || [])
      const subjects = [...new Set(((c || []) as any[]).map(course => course.subject).filter(Boolean))] as string[]
      setAllSubjects(subjects)
      if (user) {
        const [enrolledCourses, joinIds] = await Promise.all([
          getEnrolledCourses(user.id),
          getMyWorkshopJoins(user.id),
        ])
        setEnrolled(enrolledCourses.data || [])
        setJoinedWorkshops(new Set(joinIds))
      }
      setLoading(false)
    }
    load()
  }, [user])

  const handleWorkshopJoin = async (workshopId: string) => {
    if (!user) { router.push('/auth/login'); return }
    setJoiningId(workshopId)
    if (joinedWorkshops.has(workshopId)) {
      await leaveWorkshop(workshopId, user.id)
      setJoinedWorkshops(p => { const s = new Set(p); s.delete(workshopId); return s })
      setWorkshops(ws => ws.map(w => w.id === workshopId ? { ...w, enrolled_count: Math.max(0, (w.enrolled_count || 0) - 1) } : w))
    } else {
      await joinWorkshop(workshopId, user.id)
      setJoinedWorkshops(p => new Set([...p, workshopId]))
      setWorkshops(ws => ws.map(w => w.id === workshopId ? { ...w, enrolled_count: (w.enrolled_count || 0) + 1 } : w))
    }
    setJoiningId(null)
  }

  const filtered = courses.filter(c => {
    if (filterLevel   && c.level   !== filterLevel)   return false
    if (filterSubject && c.subject !== filterSubject) return false
    return true
  })

  const hasFilter = !!(filterLevel || filterSubject)

  if (loading) return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#333] border-t-white rounded-full animate-spin" />
    </div>
  )

  return (
    <>
    <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* TABS */}
      <div className="flex-shrink-0 flex border-b border-[rgba(255,255,255,0.07)] bg-[#0f0f0f]">
        {(['courses','workshops','enrolled'] as Tab[]).map(tab => (
          <button key={tab} data-tab={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3.5 text-sm font-semibold capitalize border-b-2 transition ${
              activeTab === tab ? 'text-white border-white' : 'text-[#555] border-transparent'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

        {/* COURSES TAB */}
        {activeTab === 'courses' && (
          <>
            <div className="flex items-center justify-between px-4 py-3">
              <button onClick={() => setShowFilter(true)}
                className={`flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl border transition ${
                  hasFilter ? 'bg-white text-black border-white' : 'bg-[#1a1a1a] text-[#888] border-[rgba(255,255,255,0.08)]'
                }`}>
                <SlidersHorizontal className="w-4 h-4" />
                Level &amp; subject
              </button>
              <span className="text-[#555] text-sm">{filtered.length} courses</span>
            </div>
            <div className="px-4 space-y-4">
              {filtered.length === 0
                ? <p className="text-center text-[#444] text-sm py-16">No courses found</p>
                : filtered.map(c => (
                    <CourseCard key={c.id} course={c}
                      isEnrolled={enrolled.some(e => e.id === c.id)}
                      isOwner={user?.id === c.instructor_id}
                      onTap={() => setDetailCourseId(c.id)} />
                  ))
              }
            </div>
          </>
        )}

        {/* WORKSHOPS TAB */}
        {activeTab === 'workshops' && (
          <div className="px-4 py-4 space-y-3">
            {workshops.length === 0
              ? <p className="text-center text-[#444] text-sm py-16">No workshops yet</p>
              : workshops.map(w => (
                  <WorkshopCard key={w.id} workshop={w}
                    isJoined={joinedWorkshops.has(w.id)}
                    joining={joiningId === w.id}
                    onJoin={() => handleWorkshopJoin(w.id)} />
                ))
            }
          </div>
        )}

        {/* ENROLLED TAB */}
        {activeTab === 'enrolled' && (
          <div className="px-4 py-4 space-y-3">
            {!user ? (
              <p className="text-center text-[#444] text-sm py-16">Sign in to see your enrolled courses</p>
            ) : enrolled.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[#444] text-sm mb-4">Not enrolled in anything yet</p>
                <button onClick={() => setActiveTab('courses')}
                  className="bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white text-sm font-bold px-6 py-2.5 rounded-full">
                  Browse Courses
                </button>
              </div>
            ) : (
              enrolled.map(c => (
                <EnrolledCourseCard key={c.id} course={c}
                  onJoin={() => router.push(`/courses/${c.id}/classroom`)} />
              ))
            )}
          </div>
        )}
      </div>
    </div>

    {/* FILTER SHEET */}
    {showFilter && (
      <div className="fixed inset-0 z-[60]">
        <div className="absolute inset-0 bg-black/60" onClick={() => setShowFilter(false)} />
        <div className="absolute bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-3xl px-4 pt-3 pb-8"
          onClick={e => e.stopPropagation()}>
          <div className="flex justify-center mb-4"><div className="w-10 h-1 bg-[#333] rounded-full" /></div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[#555] text-xs font-bold uppercase tracking-wider">YOUR LEVEL</p>
            <button onClick={() => setShowFilter(false)} className="w-7 h-7 bg-[#222] rounded-full flex items-center justify-center">
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {[{ value: '', label: 'Any' }, ...LEVELS.map(l => ({ value: l, label: l.charAt(0).toUpperCase() + l.slice(1) }))].map(item => (
              <button key={item.value} onClick={() => setFilterLevel(item.value)}
                className={`py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                  filterLevel === item.value ? 'bg-white text-black' : 'bg-[#252525] text-[#888]'
                }`}>
                {filterLevel === item.value && <Check className="w-3.5 h-3.5" />}
                {item.label}
              </button>
            ))}
          </div>
          {allSubjects.length > 0 && (
            <>
              <p className="text-[#555] text-xs font-bold uppercase tracking-wider mb-3">SUBJECT</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {[{ value: '', label: 'Any' }, ...allSubjects.map(s => ({ value: s, label: s }))].map(item => (
                  <button key={item.value} onClick={() => setFilterSubject(item.value)}
                    className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition ${
                      filterSubject === item.value
                        ? 'bg-white text-black'
                        : 'bg-[#252525] text-[#888] border border-[rgba(255,255,255,0.07)]'
                    }`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setFilterLevel(''); setFilterSubject(''); setShowFilter(false) }}
              className="flex-1 bg-[#252525] text-white py-3.5 rounded-2xl text-sm font-bold">Clear</button>
            <button onClick={() => setShowFilter(false)}
              className="flex-1 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white py-3.5 rounded-2xl text-sm font-bold">
              Show {filtered.length}
            </button>
          </div>
        </div>
      </div>
    )}

    {detailCourseId && (
      <CourseDetailSheet courseId={detailCourseId} onClose={() => setDetailCourseId(null)} />
    )}

    {/* Instructor create FAB */}
    {isInstructor && (
      <>
        {showCreateMenu && (
          <div className="fixed inset-0 z-40" onClick={() => setShowCreateMenu(false)} />
        )}
        {showCreateMenu && (
          <div
            className="fixed z-50 flex flex-col gap-2.5 items-end"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)', right: '20px' }}
          >
            <button
              onClick={() => { setShowCreateMenu(false); setShowCreateWorkshop(true) }}
              className="flex items-center gap-2.5 bg-[#1a1a1a] border border-[rgba(255,255,255,0.12)] text-white text-sm font-semibold px-5 py-3 rounded-full shadow-2xl whitespace-nowrap"
            >
              <Users className="w-4 h-4" /> New Workshop
            </button>
            <button
              onClick={() => { setShowCreateMenu(false); setShowCreateCourse(true) }}
              className="flex items-center gap-2.5 bg-[#1a1a1a] border border-[rgba(255,255,255,0.12)] text-white text-sm font-semibold px-5 py-3 rounded-full shadow-2xl whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4" /> New Course
            </button>
          </div>
        )}
        <button
          onClick={() => setShowCreateMenu(!showCreateMenu)}
          className="fixed z-50 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-transform"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)', right: '20px', ...(showCreateMenu && { display: 'none' }) }}
        >
          <Plus className="w-5 h-5 text-black" strokeWidth={2.5} />
        </button>
        {showCreateMenu && (
          <button
            onClick={() => setShowCreateMenu(false)}
            className="fixed z-50 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-transform"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)', right: '20px' }}
          >
            <X className="w-5 h-5 text-black" />
          </button>
        )}
      </>
    )}

    <CreateCourse   isOpen={showCreateCourse}   onClose={() => setShowCreateCourse(false)} />
    <CreateWorkshop isOpen={showCreateWorkshop} onClose={() => setShowCreateWorkshop(false)} />
    </>
  )
}

// ── CourseCard ────────────────────────────────────────────────
function CourseCard({ course, isEnrolled, isOwner, onTap }: {
  course: any
  isEnrolled?: boolean
  isOwner?: boolean
  onTap: () => void
}) {
  return (
    <div onClick={onTap}
      className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.06)] active:opacity-90 transition cursor-pointer">
      <div className="relative w-full bg-[#252525] overflow-hidden" style={{ height: '200px' }}>
        {course.thumbnail_url
          ? <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0f3460]" />
        }
        {(course.subject || course.level) && (
          <span className="absolute top-2.5 left-2.5 text-[10px] font-bold bg-black/80 text-white px-2.5 py-1 rounded-full uppercase tracking-wide">
            {[course.subject, course.level].filter(Boolean).join(' · ')}
          </span>
        )}
        {isOwner && (
          <div className="absolute top-2.5 right-2.5">
            <span className="text-[10px] font-bold bg-[#FF6B2B] text-white px-2.5 py-1 rounded-full">YOUR COURSE</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-white font-bold text-[15px] leading-snug line-clamp-2 mb-2">{course.title}</h3>
        {course.description && (
          <p className="text-[#555] text-sm line-clamp-2 mb-3 leading-snug">{course.description}</p>
        )}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] overflow-hidden flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {course.users?.avatar_url
              ? <img src={course.users.avatar_url} className="w-full h-full object-cover" />
              : course.users?.username?.[0]?.toUpperCase()}
          </div>
          <span className="text-white text-sm font-semibold flex items-center gap-1">
            {course.users?.username}
            {course.users?.verified && <VerifiedBadge size={13} />}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[#555] text-xs mb-4">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.duration_weeks}w</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(course.enrolled_count || 0).toLocaleString()}</span>
          <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />{course.rating?.toFixed(1)}</span>
        </div>
        {isOwner ? (
          <div className="w-full py-3 rounded-2xl text-center text-sm font-bold bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white">
            Start Class →
          </div>
        ) : (
          <div className={`w-full py-3 rounded-2xl text-center text-sm font-bold ${
            isEnrolled ? 'bg-[#252525] text-white' : 'bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white'
          }`}>
            {isEnrolled ? 'Enrolled ✓' : 'Enroll'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── WorkshopCard ──────────────────────────────────────────────
function WorkshopCard({ workshop, isJoined, joining, onJoin }: {
  workshop: any
  isJoined?: boolean
  joining?: boolean
  onJoin: () => void
}) {
  const date = workshop.workshop_date ? new Date(workshop.workshop_date) : null
  const dateStr = date
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.06)]">
      {/* Thumbnail */}
      <div className="relative w-full bg-[#252525] overflow-hidden" style={{ height: '190px' }}>
        {workshop.thumbnail_url
          ? <img src={workshop.thumbnail_url} alt={workshop.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0f3460]" />
        }
        {dateStr && (
          <div className="absolute top-2.5 left-2.5 bg-black/80 rounded-xl px-2.5 py-1.5">
            <p className="text-white text-xs font-bold">{dateStr}</p>
          </div>
        )}
        {workshop.location && (
          <span className="absolute top-2.5 right-2.5 text-[10px] font-bold bg-black/80 text-white px-2.5 py-1 rounded-full uppercase tracking-wide">
            {workshop.location}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-white font-bold text-[15px] leading-snug line-clamp-2 mb-2">{workshop.title}</h3>
        {workshop.description && (
          <p className="text-[#555] text-sm line-clamp-2 mb-3 leading-snug">{workshop.description}</p>
        )}

        {workshop.users && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] overflow-hidden flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {workshop.users?.avatar_url
                ? <img src={workshop.users.avatar_url} className="w-full h-full object-cover" />
                : workshop.users?.username?.[0]?.toUpperCase()}
            </div>
            <span className="text-white text-sm font-semibold flex items-center gap-1">
              {workshop.users?.username}
              {workshop.users?.verified && <VerifiedBadge size={13} />}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 text-[#555] text-xs mb-4">
          {workshop.workshop_time && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{workshop.workshop_time.slice(0, 5)}</span>
          )}
          <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" />{workshop.enrolled_count || 0} joined</span>
        </div>

        <button onClick={onJoin} disabled={joining}
          className={`w-full py-3 rounded-2xl text-sm font-bold transition active:scale-[0.98] disabled:opacity-40 ${
            isJoined
              ? 'bg-[#252525] text-white border border-[rgba(255,255,255,0.08)]'
              : 'bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white'
          }`}>
          {joining ? '…' : isJoined ? 'Joined ✓' : 'Join Workshop'}
        </button>
      </div>
    </div>
  )
}