'use client'

import RoleGate from '@/components/v2/RoleGate'
import OrgShell from '@/components/v2/OrgShell'
import { providerSections, providerPhoneItems } from '@/lib/orgNav'

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow="provider_staff">
      <OrgShell sections={providerSections} phoneItems={providerPhoneItems}>
        {children}
      </OrgShell>
    </RoleGate>
  )
}
