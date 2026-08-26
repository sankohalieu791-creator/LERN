'use client'

import RoleGate from '@/components/v2/RoleGate'
import OrgDashboard from '@/components/v2/OrgDashboard'

export default function InstitutionPage() {
  return (
    <RoleGate allow="institution_staff">
      <OrgDashboard />
    </RoleGate>
  )
}
