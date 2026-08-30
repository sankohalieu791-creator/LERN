'use client'

import { useState } from 'react'
import RoleGate from '@/components/v2/RoleGate'
import StudentShell from '@/components/v2/StudentShell'
import PostComposer from '@/components/v2/PostComposer'
import { useRouter } from 'next/navigation'

function StudentLayoutInner({ children }: { children: React.ReactNode }) {
  const [composerOpen, setComposerOpen] = useState(false)
  const router = useRouter()

  return (
    <StudentShell onPlus={() => setComposerOpen(true)}>
      {children}
      {composerOpen && (
        <PostComposer
          onClose={() => setComposerOpen(false)}
          onPosted={() => { setComposerOpen(false); router.push('/student/feed'); router.refresh() }}
        />
      )}
    </StudentShell>
  )
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow="student">
      <StudentLayoutInner>{children}</StudentLayoutInner>
    </RoleGate>
  )
}
