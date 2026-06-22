'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import type { ComponentProps } from 'react'
import type VirtualClassroomType from '@/components/VirtualClassroom'

const VirtualClassroom = dynamic<ComponentProps<typeof VirtualClassroomType>>(
  () => import('@/components/VirtualClassroom'),
  { ssr: false }
)

function WorkshopClassroomInner() {
  const { workshopId } = useParams<{ workshopId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [workshop, setWorkshop] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const { data: w } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', workshopId)
        .single()
      if (!w) return
      const instructorId = w.instructor_id || w.user_id
      if (instructorId) {
        const { data: u } = await supabase
          .from('users')
          .select('username, avatar_url')
          .eq('id', instructorId)
          .single()
        setWorkshop({ ...w, users: u })
      } else {
        setWorkshop(w)
      }
    }
    load()
  }, [workshopId])

  if (!workshop) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
      </div>
    )
  }

  const instructorId = workshop.instructor_id || workshop.user_id
  const isInstructor = !!(user && user.id === instructorId)

  return (
    <VirtualClassroom
      courseTitle={workshop.title}
      instructorName={workshop.users?.username || 'Instructor'}
      channelName={`workshop_${workshopId}`}
      isInstructor={isInstructor}
      isOpen={true}
      onClose={() => router.back()}
      courseId={workshopId}
    />
  )
}

export default function WorkshopClassroomPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
      </div>
    }>
      <WorkshopClassroomInner />
    </Suspense>
  )
}
