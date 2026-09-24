'use client'

import RoleGate from '@/components/v2/RoleGate'
import OrgShell from '@/components/v2/OrgShell'
import OnboardingTour from '@/components/v2/OnboardingTour'
import OrgBillingGate from '@/components/v2/OrgBillingGate'
import OrgVerificationGate from '@/components/v2/OrgVerificationGate'
import { providerSections, providerPhoneItems } from '@/lib/orgNav'

export default function ProviderLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow="provider_staff">
      <OrgVerificationGate>
        <OrgBillingGate>
          <OrgShell sections={providerSections} phoneItems={providerPhoneItems}>
            <OnboardingTour role="provider" />
            {children}
          </OrgShell>
        </OrgBillingGate>
      </OrgVerificationGate>
    </RoleGate>
  )
}
