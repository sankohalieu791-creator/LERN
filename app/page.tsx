'use client'

import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user) router.replace('/feed')
    else router.replace('/auth/signup')
  }, [user, loading, router])

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#333] border-t-[#FF6B2B] rounded-full animate-spin" />
    </div>
  )
}
