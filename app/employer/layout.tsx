'use client'

import RoleGate from '@/components/v2/RoleGate'
import OrgShell from '@/components/v2/OrgShell'
import GuestEmployerShell from '@/components/v2/GuestEmployerShell'
import { employerSections, employerPhoneItems } from '@/lib/orgNav'
import { useAuth } from '@/context/AuthContext'

function EmployerShellSwitch({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  // guest_invite_id is the fallback signal, not just is_guest -- the
  // trigger that sets is_guest only does so if the invite was still
  // unclaimed at the exact moment the account was created. A guest
  // invite link that gets opened more than once (very possible while
  // testing, or a stale/resent email opened after an earlier click
  // already claimed it) can land with is_guest false but
  // guest_invite_id still correctly pointing at the original invite --
  // that's still a guest, not a real employer, and belongs in the
  // scoped shell either way.
  if (user?.is_guest || user?.guest_invite_id) return <GuestEmployerShell>{children}</GuestEmployerShell>
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
