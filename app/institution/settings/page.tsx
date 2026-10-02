'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Settings moved to a modal opened from the gear icon in the top bar
// (see OrgShell.tsx), not its own route -- same interaction as
// "Create brief". Anyone with the old URL bookmarked lands on the
// dashboard instead of a dead page.
export default function InstitutionSettingsPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/institution/dashboard') }, [router])
  return null
}
