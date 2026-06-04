'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Course } from '@/lib/types'
import Link from 'next/link'
import { Star, Users, Clock } from 'lucide-react'

export default function EnrolledCoursesPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchEnrolledCourses = async () => {
      if (!user) return

      try {
        const { data } = await supabase
          .from('enrollments')
          .select('courses(*, users(*))')
          .eq('user_id', user.id)

        const enrolledCourses = data?.map((e: any) => e.courses) || []
        setCourses(enrolledCourses)
      } catch (error) {
        console.error('Error fetching enrolled courses:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEnrolledCourses()
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin">
          <div className="w-12 h-12 border-4 border-[#7C3AED] border-t-[#FF6B2B] rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* HEADER */}
      <div className="bg-[rgba(124,58,237,0.08)] border-b border-[rgba(124,58,237,0.15)] p-6 sticky top-16 z-40">
        <h1 className="text-white text-2xl font-bold">Enrolled Courses</h1>
        <p className="text-[#888] text-sm mt-1">{courses.length} courses</p>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {courses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#888] mb-4">You haven&apos;t enrolled in any courses yet</p>
            <Link
              href="/courses"
              className="inline-block bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white px-6 py-2 rounded-lg font-bold hover:shadow-lg transition"
            >
              Browse Courses
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] rounded-lg overflow-hidden hover:border-[rgba(124,58,237,0.3)] transition group cursor-pointer"
              >
                {/* THUMBNAIL */}
                <div className="relative bg-[#1a1a1a] aspect-video overflow-hidden group-hover:opacity-80 transition">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#FF6B2B] to-[#7C3AED] flex items-center justify-center">
                      <p className="text-white">Course</p>
                    </div>
                  )}
                </div>

                {/* CONTENT */}
                <div className="p-4">
                  <h3 className="text-white font-bold text-sm mb-2 line-clamp-2 group-hover:text-[#00D9FF] transition">
                    {course.title}
                  </h3>

                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#7C3AED]" />
                    <p className="text-[#888] text-xs">
                      {course.users?.username}
                      {course.users?.verified && ' ✓'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#888] mb-3 pb-3 border-b border-[rgba(124,58,237,0.1)]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {course.duration_weeks}w
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {course.enrolled_count}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-white text-sm font-bold">{course.rating.toFixed(1)}</span>
                    </div>
                    <button className="bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white px-3 py-1 rounded text-xs font-semibold hover:shadow-lg transition">
                      Join
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
