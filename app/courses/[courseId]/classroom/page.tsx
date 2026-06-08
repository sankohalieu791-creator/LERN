'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getCourseById } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import type { ComponentProps } from 'react'
import type VirtualClassroomType from '@/components/VirtualClassroom'

const VirtualClassroom = dynamic<ComponentProps<typeof VirtualClassroomType>>(
  () => import('@/components/VirtualClassroom'),
  { ssr: false }
)

export default function ClassroomPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [course, setCourse] = useState<any>(null)

  useEffect(() => {
    getCourseById(courseId).then(({ data }) => setCourse(data))
  }, [courseId])

  if (!course) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
      </div>
    )
  }

  const isInstructor = !!(user && user.id === course.instructor_id)

  return (
    <VirtualClassroom
      courseTitle={course.title}
      instructorName={course.users?.username || 'Instructor'}
      channelName={`course_${courseId}`}
      isInstructor={isInstructor}
      isOpen={true}
      onClose={() => router.back()}
    />
  )
}
