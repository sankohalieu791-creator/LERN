'use client'

import { useState, useEffect } from 'react'
import { X, Star, Users, Clock, Calendar } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getCourseById, enrollCourse, isEnrolled } from '@/lib/supabase'
import { Course, CourseSession } from '@/lib/types'
import Link from 'next/link'

export default function CourseDetailPage() {
  const { courseId } = useParams()
  const { user } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [sessions, setSessions] = useState<CourseSession[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(false)
  const [showEnrollModal, setShowEnrollModal] = useState(false)

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const { data } = await getCourseById(courseId as string)
        setCourse(data)
        setSessions(data?.course_sessions || [])

        if (user) {
          const { data: isEnrolledData } = await isEnrolled(courseId as string, user.id)
          setEnrolled(!!isEnrolledData)
        }
      } catch (error) {
        console.error('Error fetching course:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCourse()
  }, [courseId, user])

  const handleEnroll = async () => {
    if (!user) return

    try {
      await enrollCourse(courseId as string, user.id)
      setEnrolled(true)
      setShowEnrollModal(false)
    } catch (error) {
      console.error('Error enrolling:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin">
          <div className="w-12 h-12 border-4 border-[#7C3AED] border-t-[#FF6B2B] rounded-full"></div>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-[#888]">Course not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* HERO */}
      <div className="relative bg-[#1a1a1a] aspect-video overflow-hidden">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#FF6B2B] to-[#7C3AED] flex items-center justify-center">
            <p className="text-white text-xl">Course Cover</p>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* HEADER */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[#00D9FF] text-xs font-bold bg-[rgba(0,217,255,0.2)] px-3 py-1 rounded">
              {course.level?.toUpperCase()}
            </span>
            <span className="text-[#00D9FF] text-xs font-bold bg-[rgba(0,217,255,0.2)] px-3 py-1 rounded">
              {course.subject}
            </span>
          </div>

          <h1 className="text-white text-4xl font-bold mb-4">{course.title}</h1>

          <div className="flex items-center gap-6 mb-6">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#7C3AED]" />
            <div>
              <p className="text-white font-bold">
                {course.users?.username}
                {course.users?.verified && ' ✓'}
              </p>
              <p className="text-[#888] text-sm">Instructor</p>
            </div>
          </div>

          {/* STATS */}
          <div className="flex gap-8 mb-6 pb-6 border-b border-[rgba(124,58,237,0.1)]">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <span className="text-white font-bold">{course.rating.toFixed(1)}</span>
              <span className="text-[#888] text-sm">(245 reviews)</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-[#00D9FF]" />
              <span className="font-bold">{course.enrolled_count}</span>
              <span className="text-[#888] text-sm">enrolled</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <Clock className="w-5 h-5 text-[#FF6B2B]" />
              <span className="font-bold">{course.duration_weeks}</span>
              <span className="text-[#888] text-sm">weeks</span>
            </div>
          </div>

          {/* DESCRIPTION */}
          <p className="text-[#888] text-lg mb-8">{course.description}</p>

          {/* ENROLL BUTTON */}
          {!enrolled ? (
            <button
              onClick={() => setShowEnrollModal(true)}
              className="bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white px-8 py-4 rounded-lg font-bold hover:shadow-lg transition"
            >
              Enroll Now
            </button>
          ) : (
            <Link
              href={`/courses/${courseId}/workshops/${courseId}`}
              className="inline-block bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white px-8 py-4 rounded-lg font-bold hover:shadow-lg transition"
            >
              Join Course
            </Link>
          )}
        </div>

        {/* COURSE SESSIONS */}
        <div>
          <h2 className="text-white text-2xl font-bold mb-6">Course Content</h2>
          <div className="space-y-3">
            {sessions.length === 0 ? (
              <p className="text-[#888]">No sessions available</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] rounded-lg p-4 hover:border-[rgba(124,58,237,0.3)] transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-white font-bold text-sm">
                          Session {session.session_number}
                        </span>
                        {session.is_project_day && (
                          <span className="text-[#FF3B30] text-xs font-bold bg-[rgba(255,59,48,0.2)] px-2 py-1 rounded">
                            PROJECTS DAY
                          </span>
                        )}
                        {session.is_live && (
                          <span className="text-[#2ECC71] text-xs font-bold bg-[rgba(46,204,113,0.2)] px-2 py-1 rounded">
                            LIVE
                          </span>
                        )}
                      </div>
                      <p className="text-white font-semibold">{session.title}</p>
                      <p className="text-[#888] text-sm mt-1">{session.description}</p>
                      <div className="flex items-center gap-4 mt-3 text-[#888] text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {session.session_date}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {session.session_time}
                        </div>
                      </div>
                    </div>
                    {enrolled && session.is_live && (
                      <button className="bg-[#2ECC71] text-white px-4 py-2 rounded font-semibold hover:bg-[#27AE60] transition">
                        Join Live
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ENROLL MODAL */}
      {showEnrollModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEnrollModal(false)}
        >
          <div
            className="bg-[#1a1a1a] rounded-xl w-full max-w-md p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-2xl font-bold">Enroll in Course</h2>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="p-2 hover:bg-[rgba(124,58,237,0.2)] rounded-full transition"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-[#888] mb-4">You&apos;re about to enroll in:</p>
              <div className="bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] rounded-lg p-4 mb-4">
                <p className="text-white font-bold">{course.title}</p>
                <p className="text-[#888] text-sm mt-2">by {course.users?.username}</p>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex items-center justify-between text-white">
                  <span>Course Duration:</span>
                  <span className="font-bold">{course.duration_weeks} weeks</span>
                </div>
                <div className="flex items-center justify-between text-white">
                  <span>Sessions:</span>
                  <span className="font-bold">{sessions.length}</span>
                </div>
                <div className="flex items-center justify-between text-white">
                  <span>Price:</span>
                  <span className="font-bold text-[#2ECC71]">FREE</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleEnroll}
              className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white font-bold py-3 rounded-lg hover:shadow-lg transition"
            >
              Confirm Enrollment
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
