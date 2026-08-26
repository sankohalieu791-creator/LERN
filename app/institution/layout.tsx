'use client'

import RoleGate from '@/components/v2/RoleGate'
import OrgShell from '@/components/v2/OrgShell'
import { institutionSections, institutionPhoneItems } from '@/lib/orgNav'

export default function InstitutionLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow="institution_staff">
      <OrgShell sections={institutionSections} phoneItems={institutionPhoneItems}>
        {children}
      </OrgShell>
    </RoleGate>
  )
}
