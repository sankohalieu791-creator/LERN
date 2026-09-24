'use client'

import RoleGate from '@/components/v2/RoleGate'
import OrgShell from '@/components/v2/OrgShell'
import OnboardingChecklist from '@/components/v2/OnboardingChecklist'
import OrgBillingGate from '@/components/v2/OrgBillingGate'
import OrgVerificationGate from '@/components/v2/OrgVerificationGate'
import { institutionSections, institutionPhoneItems } from '@/lib/orgNav'

export default function InstitutionLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow="institution_staff">
      <OrgVerificationGate>
        <OrgBillingGate>
          <OrgShell sections={institutionSections} phoneItems={institutionPhoneItems}>
            <OnboardingChecklist role="institution" />
            {children}
          </OrgShell>
        </OrgBillingGate>
      </OrgVerificationGate>
    </RoleGate>
  )
}
