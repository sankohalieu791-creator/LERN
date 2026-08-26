'use client'

import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { routeForRole } from '@/lib/roleRouting'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    router.replace(user ? routeForRole(user.role) : '/auth/start')
  }, [user, loading, router])

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <span className="w-6 h-6 border-2 border-[#E2DDD1] border-t-brand rounded-full animate-spin" />
    </div>
  )
}
