'use client'

import RoleGate from '@/components/v2/RoleGate'
import OrgShell from '@/components/v2/OrgShell'
import OnboardingTour from '@/components/v2/OnboardingTour'
import { institutionSections, institutionPhoneItems } from '@/lib/orgNav'

export default function InstitutionLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow="institution_staff">
      <OrgShell sections={institutionSections} phoneItems={institutionPhoneItems}>
        <OnboardingTour role="institution" />
        {children}
      </OrgShell>
    </RoleGate>
  )
}
