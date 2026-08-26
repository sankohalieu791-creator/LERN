'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function InstitutionRootPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/institution/dashboard') }, [router])
  return null
}
