'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getCourseById, completeSession } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import type { ComponentProps } from 'react'
import type VirtualClassroomType from '@/components/VirtualClassroom'

const VirtualClassroom = dynamic<ComponentProps<typeof VirtualClassroomType>>(
  () => import('@/components/VirtualClassroom'),
  { ssr: false }
)

function ClassroomInner() {
  const { courseId } = useParams<{ courseId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')
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

  const handleClose = async () => {
    if (isInstructor && sessionId) {
      await completeSession(sessionId)
    }
    router.back()
  }

  return (
    <VirtualClassroom
      courseTitle={course.title}
      instructorName={course.users?.username || 'Instructor'}
      channelName={`course_${courseId}`}
      isInstructor={isInstructor}
      isOpen={true}
      onClose={handleClose}
      courseId={courseId}
    />
  )
}

export default function ClassroomPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
      </div>
    }>
      <ClassroomInner />
    </Suspense>
  )
}
