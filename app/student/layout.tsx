'use client'

import RoleGate from '@/components/v2/RoleGate'
import StudentShell from '@/components/v2/StudentShell'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow="student">
      <StudentShell>{children}</StudentShell>
    </RoleGate>
  )
}
