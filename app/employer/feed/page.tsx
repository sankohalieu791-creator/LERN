'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Feed removed from employer entirely -- see lib/orgNav.ts's comment.
// This route stays only to bounce a stale bookmark/link somewhere safe
// rather than 404 or (worse, before this fix) actually render every
// organisation's posts.
export default function EmployerFeedPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/employer/discover') }, [router])
  return null
}
