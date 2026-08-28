'use client'

import RoleGate from '@/components/v2/RoleGate'
import OrgShell from '@/components/v2/OrgShell'
import GuestEmployerShell from '@/components/v2/GuestEmployerShell'
import { employerSections, employerPhoneItems } from '@/lib/orgNav'
import { useAuth } from '@/context/AuthContext'

function EmployerShellSwitch({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.is_guest) return <GuestEmployerShell>{children}</GuestEmployerShell>
  return (
    <OrgShell sections={employerSections} phoneItems={employerPhoneItems}>
      {children}
    </OrgShell>
  )
}

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow="employer">
      <EmployerShellSwitch>{children}</EmployerShellSwitch>
    </RoleGate>
  )
}
