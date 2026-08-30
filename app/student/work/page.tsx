'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Temporarily pulled from the nav — being rebuilt to spec, one screen
// at a time, starting with Feed. Redirects rather than 404s in case
// this URL is bookmarked/still linked anywhere.
export default function StudentWorkPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/student/feed') }, [router])
  return null
}
