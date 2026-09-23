'use client'

import RoleGate from '@/components/v2/RoleGate'
import OrgShell from '@/components/v2/OrgShell'
import GuestEmployerShell from '@/components/v2/GuestEmployerShell'
import PendingEmployerVerification from '@/components/v2/PendingEmployerVerification'
import EmployerBillingGate from '@/components/v2/EmployerBillingGate'
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

  // Employer vetting gate (Michael's Sep-10 review) -- an independent
  // employer sees a pending-verification screen, not full access,
  // until employer_verified is set true by an admin. Only applies here
  // (never guests, handled above) -- once vetted this branch never
  // fires again for this account.
  if (!user?.employer_verified) return <PendingEmployerVerification />

  // Payment verification fix, 23 Sep 2026 -- access to the real app was
  // previously granted the moment employer_verified was true, with
  // nothing checking whether a plan had ever been chosen or paid for.
  // EmployerBillingGate reads the real subscription state from the
  // database (never the Checkout redirect alone) and only renders
  // children once it's genuinely confirmed.
  return (
    <EmployerBillingGate>
      <OrgShell sections={employerSections} phoneItems={employerPhoneItems}>
        {children}
      </OrgShell>
    </EmployerBillingGate>
  )
}

export default function EmployerLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow="employer">
      <EmployerShellSwitch>{children}</EmployerShellSwitch>
    </RoleGate>
  )
}
