'use client'

import RoleGate from '@/components/v2/RoleGate'
import OrgDashboard from '@/components/v2/OrgDashboard'

export default function ProviderPage() {
  return (
    <RoleGate allow="provider_staff">
      <OrgDashboard />
    </RoleGate>
  )
}
