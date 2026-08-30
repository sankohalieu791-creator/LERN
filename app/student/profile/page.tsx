'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Temporarily pulled from the nav — see app/student/work/page.tsx.
export default function StudentProfilePage() {
  const router = useRouter()
  useEffect(() => { router.replace('/student/feed') }, [router])
  return null
}
