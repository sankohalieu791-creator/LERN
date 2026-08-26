'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProviderRootPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/provider/dashboard') }, [router])
  return null
}
