'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function EmployerRootPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (loading) return
    router.replace(user?.is_guest ? '/employer/shared' : '/employer/discover')
  }, [loading, user, router])
  return null
}
