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
    <>
      <StudentShell onPlus={() => setComposerOpen(true)}>
        {children}
      </StudentShell>
      {/* A true top-level sibling of the shell now, not nested inside
          it -- it used to render as part of StudentShell's `children`,
          which places it inside <main>, the app's own scrollable
          container. position:fixed is supposed to escape that
          regardless per spec, but nesting a full-screen modal inside a
          scrolling ancestor is exactly the kind of thing mobile
          WebKit/webview builds are inconsistent about in practice --
          "can't see the create or X" is consistent with the modal (or
          parts of it) rendering clipped to main's box on some devices
          rather than the true viewport. Rendering it here removes any
          dependency on that at all. */}
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
    </>
  )
}
