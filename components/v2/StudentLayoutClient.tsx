'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import StudentShell from '@/components/v2/StudentShell'
import PostComposer from '@/components/v2/PostComposer'

export default function StudentLayoutClient({ children }: { children: React.ReactNode }) {
  const [composerOpen, setComposerOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  return (
    <StudentShell onPlus={() => setComposerOpen(true)}>
      {children}
      {composerOpen && (
        <PostComposer
          onClose={() => setComposerOpen(false)}
          onPosted={() => {
            setComposerOpen(false)
            // Already on Feed -> nothing to navigate to, so force a real
            // reload to pick up the new post (FeedPanel fetches once on
            // mount, a same-route push won't remount it). Anywhere else,
            // a normal navigation to Feed mounts it fresh.
            if (pathname === '/student/feed') window.location.reload()
            else router.push('/student/feed')
          }}
        />
      )}
    </StudentShell>
  )
}
