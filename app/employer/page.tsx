'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EmployerRootPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/employer/discover') }, [router])
  return null
}
