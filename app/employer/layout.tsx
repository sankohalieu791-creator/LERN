'use client'

import RoleGate from '@/components/v2/RoleGate'
import OrgShell from '@/components/v2/OrgShell'
import { employerSections, employerPhoneItems } from '@/lib/orgNav'

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow="employer">
      <OrgShell sections={employerSections} phoneItems={employerPhoneItems}>
        {children}
      </OrgShell>
    </RoleGate>
  )
}
