'use client'

import { useState, useEffect } from 'react'
import {
  SlidersHorizontal, Star, Clock, Users, X, Check,
  Calendar, ShieldCheck, ChevronRight, Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getCourses, getWorkshops, getCourseById, enrollCourse, isEnrolled } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

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

const SUBJECTS = ['TYPESCRIPT','JAVASCRIPT','REACT','PYTHON','FITNESS','MUSIC','BUSINESS','EXAM PREP','SPANISH']
const LEVELS   = ['beginner','intermediate','advanced']

type Tab = 'courses' | 'workshops' | 'enrolled'

// ── Course detail bottom sheet ────────────────────────────────
function CourseDetailSheet({
  courseId, onClose,
}: { courseId: string; onClose: () => void }) {
  const { user } = useAuth()
  const router   = useRouter()
  const [course,    setCourse]    = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [enrolled,  setEnrolled]  = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [success,   setSuccess]   = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await getCourseById(courseId)
      setCourse(data)
      if (user) {
        const { data: enrolled } = await isEnrolled(courseId, user.id)
        setEnrolled(!!enrolled)
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

  const sessions = course?.course_sessions?.slice().sort((a: any, b: any) =>
    new Date(a.session_date || 0).getTime() - new Date(b.session_date || 0).getTime()
  ) ?? []

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#141414] rounded-t-3xl flex flex-col" style={{ maxHeight: '92vh' }}>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 flex-shrink-0">
          <div className="w-10 h-1 bg-[#333] rounded-full" />
        </div>
        {/* Close */}
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
          <div className="flex-1 overflow-y-auto px-5 pb-10">

            {/* TITLE */}
            <h2 className="text-white text-xl font-bold leading-snug mb-3">{course?.title}</h2>

            {/* INSTRUCTOR */}
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

            {/* STATS */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4 text-sm text-[#888]">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {course?.duration_weeks}w
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {(course?.enrolled_count || 0).toLocaleString()}
                </span>
                <span className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  {course?.rating?.toFixed(1)}
                </span>
              </div>
              <span className="text-xs font-bold border border-[rgba(255,255,255,0.15)] text-[#888] px-3 py-1 rounded-full capitalize">
                {course?.level}
              </span>
            </div>

            {/* CERTIFICATE BADGE */}
            <div className="flex items-center gap-2.5 bg-[#1e1e1e] border border-[rgba(255,255,255,0.07)] rounded-2xl px-4 py-3.5 mb-5">
              <ShieldCheck className="w-5 h-5 text-[#FF6B2B] flex-shrink-0" />
              <p className="text-white text-sm font-medium">Includes verified certificate on completion</p>
            </div>

            {/* TIMETABLE */}
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
                        {d ? (
                          <div className="flex-shrink-0 w-12 text-center">
                            <p className="text-[#555] text-[9px] font-bold">{mon}</p>
                            <p className="text-white font-bold text-xl leading-none">{day}</p>
                          </div>
                        ) : (
                          <div className="flex-shrink-0 w-12 text-center">
                            <p className="text-white font-bold text-xl leading-none">{s.session_number}</p>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{s.title}</p>
                          <p className="text-[#555] text-xs mt-0.5">
                            {d?.toLocaleString('default', { weekday: 'short' })}
                            {s.session_time && ` ${s.session_time.slice(0, 5)}`}
                            {' · 60 min'}
                          </p>
                        </div>
                        {s.is_project_day && (
                          <span className="text-[9px] font-bold bg-red-500 text-white px-2 py-1 rounded-full flex-shrink-0">
                            PROJECTS DAY
                          </span>
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

            {/* ENROLL / JOIN BUTTON */}
            <div className="mt-6">
              {enrolled ? (
                <Link
                  href={`/courses/${courseId}/classroom`}
                  className="block w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl text-center"
                >
                  Enter Live Classroom
                </Link>
              ) : (
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {enrolling
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Enrolling…</>
                    : success ? '✓ Enrolled!' : 'Enroll — Free'
                  }
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function CoursesPage() {
  const { user } = useAuth()
  const [activeTab,  setActiveTab]  = useState<Tab>('courses')
  const [courses,    setCourses]    = useState<any[]>([])
  const [workshops,  setWorkshops]  = useState<any[]>([])
  const [enrolled,   setEnrolled]   = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showFilter, setShowFilter] = useState(false)
  const [filterLevel,   setFilterLevel]   = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [detailCourseId, setDetailCourseId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: c }, { data: w }] = await Promise.all([getCourses(), getWorkshops()])
      setCourses(c || [])
      setWorkshops(w || [])
      if (user) {
        const { data: e } = await supabase
          .from('enrollments')
          .select('courses(*, users(*))')
          .eq('user_id', user.id)
          .not('course_id', 'is', null)
        setEnrolled(((e || []) as any[]).map(r => r.courses).filter(Boolean))
      }
      setLoading(false)
    }
    load()
  }, [user])

  const filtered = courses.filter(c => {
    if (filterLevel   && c.level   !== filterLevel)   return false
    if (filterSubject && c.subject !== filterSubject) return false
    return true
  })

  const hasFilter = !!(filterLevel || filterSubject)

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#333] border-t-white rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-20">

      {/* TABS — sticky at top (no global navbar) */}
      <div className="flex border-b border-[rgba(255,255,255,0.07)] sticky top-0 bg-[#0f0f0f] z-30">
        {(['courses','workshops','enrolled'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3.5 text-sm font-semibold capitalize border-b-2 transition ${
              activeTab === tab ? 'text-white border-white' : 'text-[#555] border-transparent hover:text-[#888]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── COURSES TAB ─────────────────────────────────────── */}
      {activeTab === 'courses' && (
        <>
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setShowFilter(true)}
              className={`flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl border transition ${
                hasFilter ? 'bg-white text-black border-white' : 'bg-[#1a1a1a] text-[#888] border-[rgba(255,255,255,0.08)] hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Level &amp; subject
            </button>
            <span className="text-[#555] text-sm">{filtered.length} courses</span>
          </div>
          <div className="px-4 space-y-3">
            {filtered.length === 0
              ? <p className="text-center text-[#444] text-sm py-16">No courses found</p>
              : filtered.map(c => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    isEnrolled={enrolled.some(e => e.id === c.id)}
                    onTap={() => setDetailCourseId(c.id)}
                  />
                ))
            }
          </div>
        </>
      )}

      {/* ── WORKSHOPS TAB ───────────────────────────────────── */}
      {activeTab === 'workshops' && (
        <div className="px-4 py-4 space-y-3">
          {workshops.length === 0
            ? <p className="text-center text-[#444] text-sm py-16">No workshops yet</p>
            : workshops.map(w => <WorkshopCard key={w.id} workshop={w} />)
          }
        </div>
      )}

      {/* ── ENROLLED TAB ────────────────────────────────────── */}
      {activeTab === 'enrolled' && (
        <div className="px-4 py-4 space-y-3">
          {!user ? (
            <p className="text-center text-[#444] text-sm py-16">Sign in to see your enrolled courses</p>
          ) : enrolled.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#444] text-sm mb-4">Not enrolled in anything yet</p>
              <button onClick={() => setActiveTab('courses')} className="bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white text-sm font-bold px-6 py-2.5 rounded-full">
                Browse Courses
              </button>
            </div>
          ) : (
            enrolled.map(c => (
              <CourseCard
                key={c.id}
                course={c}
                isEnrolled
                onTap={() => setDetailCourseId(c.id)}
              />
            ))
          )}
        </div>
      )}

      {/* ── FILTER SHEET ────────────────────────────────────── */}
      {showFilter && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowFilter(false)} />
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-2xl px-4 pt-3 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center mb-3"><div className="w-10 h-1 bg-[#333] rounded-full" /></div>
            <p className="text-[#555] text-xs font-bold uppercase tracking-wider mb-3">Level</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {[{ value: '', label: 'Any' }, ...LEVELS.map(l => ({ value: l, label: l.charAt(0).toUpperCase() + l.slice(1) }))].map(item => (
                <button
                  key={item.value}
                  onClick={() => setFilterLevel(item.value)}
                  className={`py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition ${
                    filterLevel === item.value ? 'bg-white text-black' : 'bg-[#252525] text-[#888] hover:text-white'
                  }`}
                >
                  {filterLevel === item.value && <Check className="w-3.5 h-3.5" />}
                  {item.label}
                </button>
              ))}
            </div>
            <p className="text-[#555] text-xs font-bold uppercase tracking-wider mb-3">Subject</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {[{ value: '', label: 'Any' }, ...SUBJECTS.map(s => ({ value: s, label: s }))].map(item => (
                <button
                  key={item.value}
                  onClick={() => setFilterSubject(item.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                    filterSubject === item.value ? 'bg-white text-black' : 'bg-[#252525] text-[#888] border border-[rgba(255,255,255,0.07)] hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setFilterLevel(''); setFilterSubject(''); setShowFilter(false) }} className="flex-1 bg-[#252525] text-white py-3 rounded-xl text-sm font-bold">Clear</button>
              <button onClick={() => setShowFilter(false)} className="flex-1 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white py-3 rounded-xl text-sm font-bold">Show {filtered.length}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── COURSE DETAIL SHEET ─────────────────────────────── */}
      {detailCourseId && (
        <CourseDetailSheet
          courseId={detailCourseId}
          onClose={() => setDetailCourseId(null)}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────
function CourseCard({ course, isEnrolled, onTap }: {
  course: any
  isEnrolled?: boolean
  onTap: () => void
}) {
  return (
    <div
      onClick={onTap}
      className="block bg-[#1a1a1a] rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] transition cursor-pointer"
    >
      <div className="aspect-video bg-[#252525] relative overflow-hidden">
        {course.thumbnail_url
          ? <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0f3460]" />
        }
        <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/70 text-white px-2 py-0.5 rounded uppercase">
          {course.subject} · {course.level}
        </span>
        <span className="absolute top-2 right-2 text-[10px] font-bold bg-[#1d9bf0]/90 text-white px-2 py-0.5 rounded">CERT</span>
        <span className="absolute top-8 right-2 text-[10px] font-bold bg-green-500/90 text-white px-2 py-0.5 rounded">FREE</span>
      </div>
      <div className="p-4">
        <h3 className="text-white font-bold text-sm leading-snug mb-2 line-clamp-2">{course.title}</h3>
        <p className="text-[#444] text-xs mb-3 line-clamp-2">{course.description}</p>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] overflow-hidden flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {course.users?.avatar_url ? <img src={course.users.avatar_url} className="w-full h-full object-cover" /> : course.users?.username?.[0]}
          </div>
          <span className="text-[#666] text-xs font-semibold flex items-center gap-1">
            {course.users?.username}
            {course.users?.verified && <VerifiedBadge size={10} />}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[#555] text-xs">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.duration_weeks}w</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(course.enrolled_count || 0).toLocaleString()}</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />{course.rating?.toFixed(1)}</span>
          </div>
          <span className={`text-xs font-bold px-4 py-1.5 rounded-full ${
            isEnrolled
              ? 'bg-[#252525] text-white'
              : 'bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white'
          }`}>
            {isEnrolled ? 'Join' : 'Enroll — Free'}
          </span>
        </div>
      </div>
    </div>
  )
}

function WorkshopCard({ workshop }: { workshop: any }) {
  const date = workshop.workshop_date ? new Date(workshop.workshop_date) : null
  return (
    <div className="block bg-[#1a1a1a] rounded-2xl border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] transition p-4">
      <div className="flex items-start gap-4">
        {date && (
          <div className="flex-shrink-0 w-12 text-center bg-[#252525] rounded-xl py-2">
            <p className="text-[#888] text-[9px] font-bold uppercase">{date.toLocaleString('default', { month: 'short' })}</p>
            <p className="text-white font-bold text-xl leading-none">{date.getDate()}</p>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-sm leading-snug mb-1">{workshop.title}</h3>
          <p className="text-[#444] text-xs mb-2 line-clamp-2">{workshop.description}</p>
          <div className="flex items-center gap-2 text-[#555] text-xs">
            <span>{workshop.workshop_time}</span>
            <span>·</span>
            <span>{workshop.is_online ? 'Online' : workshop.location}</span>
            <span>·</span>
            <span>{workshop.enrolled_count}/{workshop.max_participants} joined</span>
          </div>
        </div>
      </div>
    </div>
  )
}
