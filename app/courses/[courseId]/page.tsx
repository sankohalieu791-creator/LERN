'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCourseById, enrollCourse, isEnrolled } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Clock, Users, Star, ShieldCheck, Calendar, ChevronLeft, Loader2 } from 'lucide-react'
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

export default function CourseDetailPage() {
  const { courseId } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [course, setCourse] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(false)
  const [enrolling, setEnrolling] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await getCourseById(courseId as string)
      setCourse(data)
      setSessions(
        (data?.course_sessions || []).slice().sort((a: any, b: any) =>
          new Date(a.session_date || 0).getTime() - new Date(b.session_date || 0).getTime()
        )
      )
      if (user) {
        const { data: e } = await isEnrolled(courseId as string, user.id)
        setEnrolled(!!e)
      }
      setLoading(false)
    }
    fetch()
  }, [courseId, user])

  const handleEnroll = async () => {
    if (!user) { router.push('/auth/login'); return }
    setEnrolling(true)
    await enrollCourse(courseId as string, user.id)
    setEnrolled(true)
    setEnrolling(false)
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

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] overflow-y-auto">

      {/* HERO THUMBNAIL */}
      <div className="relative w-full flex-shrink-0 bg-[#1a1a1a]" style={{ height: '240px' }}>
        {course.thumbnail_url
          ? <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0f3460]" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-transparent to-black/30" />

        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center z-10"
          style={{ marginTop: 'env(safe-area-inset-top)' }}
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>

        <div className="absolute top-4 right-4 flex gap-1.5" style={{ marginTop: 'env(safe-area-inset-top)' }}>
          <span className="text-[10px] font-bold bg-[#1d9bf0] text-white px-2 py-1 rounded-full">CERT</span>
          <span className="text-[10px] font-bold bg-green-500 text-white px-2 py-1 rounded-full">FREE</span>
        </div>

        {(course.subject || course.level) && (
          <span className="absolute bottom-4 left-4 text-[10px] font-bold bg-black/80 text-white px-2.5 py-1 rounded-full uppercase tracking-wide">
            {[course.subject, course.level].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>

      {/* CONTENT */}
      <div className="px-4 pt-5 pb-32">

        <h1 className="text-white font-bold text-xl leading-snug mb-4">{course.title}</h1>

        {/* Instructor */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
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

        {/* Description */}
        <p className="text-[#888] text-sm leading-relaxed mb-5">{course.description}</p>

        {/* Stats */}
        <div className="flex items-center gap-5 mb-5 pb-5 border-b border-[rgba(255,255,255,0.07)]">
          <div className="flex items-center gap-1.5 text-[#888] text-sm">
            <Clock className="w-4 h-4" />
            <span>{course.duration_weeks}w</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#888] text-sm">
            <Users className="w-4 h-4" />
            <span>{(course.enrolled_count || 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-white font-bold">{course.rating?.toFixed(1)}</span>
          </div>
          <span className="ml-auto text-xs font-bold border border-[rgba(255,255,255,0.15)] text-[#888] px-3 py-1 rounded-full capitalize">
            {course.level}
          </span>
        </div>

        {/* Certificate banner */}
        <div className="flex items-center gap-3 bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl px-4 py-3.5 mb-6">
          <ShieldCheck className="w-5 h-5 text-[#FF6B2B] flex-shrink-0" />
          <p className="text-white text-sm font-medium">Includes verified certificate on completion</p>
        </div>

        {/* Timetable */}
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
                  <div key={s.id} className="flex items-center gap-3 bg-[#1a1a1a] rounded-2xl px-4 py-3">
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
                        {s.session_time && ` · ${s.session_time.slice(0, 5)}`}
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
      </div>

      {/* STICKY ENROLL BUTTON */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-[#0f0f0f] border-t border-[rgba(255,255,255,0.07)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
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
            {enrolling ? <><Loader2 className="w-4 h-4 animate-spin" />Enrolling…</> : 'Enroll — Free'}
          </button>
        )}
      </div>
    </div>
  )
}