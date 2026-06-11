'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Lock, Clock, Users, Star, BookOpen } from 'lucide-react'

function VerifiedBadge({ size = 10 }: { size?: number }) {
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

function EnrolledCourseCard({ course, onJoin }: { course: any; onJoin: () => void }) {
  const sessions = ((course.course_sessions || []) as any[])
    .slice()
    .sort((a: any, b: any) => new Date(a.session_date || '9999').getTime() - new Date(b.session_date || '9999').getTime())

  const isLive = sessions.some((s: any) => s.is_live)
  const allCompleted = sessions.length > 0 && sessions.every((s: any) => s.is_completed)
  const hasStarted = sessions.some((s: any) => s.is_completed)
  const nextSession = sessions.find((s: any) => !s.is_completed && !s.is_live)
  const nextDateStr = nextSession?.session_date
    ? new Date(nextSession.session_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null
  const nextTime = nextSession?.session_time ? nextSession.session_time.slice(0, 5) : null
  const firstSession = sessions[0]
  const startDateStr = firstSession?.session_date
    ? new Date(firstSession.session_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{course.enrolled_count ?? 0}</span>
            {course.rating > 0 && (
              <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />{course.rating?.toFixed(1)}</span>
            )}
          </div>

          {isLive ? (
            <button onClick={onJoin}
              className="bg-red-500 text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              Join Live
            </button>
          ) : allCompleted ? (
            <span className="text-[#555] text-xs font-bold px-4 py-1.5 rounded-full bg-[#252525] border border-[rgba(255,255,255,0.07)]">
              Completed
            </span>
          ) : nextDateStr ? (
            <button onClick={onJoin}
              className="bg-[#252525] text-[#888] text-xs font-bold px-4 py-1.5 rounded-full border border-[rgba(255,255,255,0.07)]">
              {hasStarted ? 'Next' : 'Starts'} {nextDateStr}{nextTime ? ` · ${nextTime}` : ''}
            </button>
          ) : (
            <button onClick={onJoin}
              className="bg-[#252525] text-[#666] text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5 border border-[rgba(255,255,255,0.07)]">
              <Lock className="w-3 h-3" />
              {startDateStr ?? 'Soon'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EnrolledCoursesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { data } = await supabase
        .from('enrollments')
        .select('courses(*, users(*), course_sessions(*))')
        .eq('user_id', user.id)
        .not('course_id', 'is', null)
      setCourses(((data || []) as any[]).map((r: any) => r.courses).filter(Boolean))
      setLoading(false)
    }
    load()
  }, [user])

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-[rgba(255,255,255,0.07)]">
          <div className="h-3 bg-[#1e1e1e] rounded w-12 mb-2" />
          <div className="h-5 bg-[#1e1e1e] rounded w-32" />
        </div>
        <div className="px-4 py-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.06)] animate-pulse">
              <div className="aspect-video bg-[#252525]" />
              <div className="p-4 space-y-2">
                <div className="h-3.5 bg-[#252525] rounded w-3/4" />
                <div className="h-3 bg-[#252525] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-[rgba(255,255,255,0.07)]">
        <button onClick={() => router.back()} className="text-[#888] text-sm mb-2">← Back</button>
        <h1 className="text-white text-xl font-bold">My Courses</h1>
        <p className="text-[#555] text-xs mt-0.5">{courses.length} enrolled</p>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-4">
              <BookOpen className="w-7 h-7 text-[#333]" />
            </div>
            <p className="text-white font-bold text-lg mb-2">No courses yet</p>
            <p className="text-[#444] text-sm mb-5">Enroll in a course to get started</p>
            <button
              onClick={() => router.push('/courses')}
              className="bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white text-sm font-bold px-6 py-2.5 rounded-full"
            >
              Browse Courses
            </button>
          </div>
        ) : (
          courses.map(c => (
            <EnrolledCourseCard
              key={c.id}
              course={c}
              onJoin={() => router.push(`/courses/${c.id}/classroom`)}
            />
          ))
        )}
      </div>
    </div>
  )
}
