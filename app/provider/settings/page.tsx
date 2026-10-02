'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Settings moved to a modal opened from the gear icon in the top bar
// (see OrgShell.tsx), not its own route -- same interaction as
// "Create brief". Anyone with the old URL bookmarked lands on the
// dashboard instead of a dead page.
export default function ProviderSettingsPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/provider/dashboard') }, [router])
  return null
}
