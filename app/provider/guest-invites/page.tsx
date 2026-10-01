'use client'

import GuestInvitePanel from '@/components/v2/GuestInvitePanel'

// Same component institution uses -- driven entirely by the signed-in
// staff member's own organisation_id, nothing institution-specific
// hardcoded. Providers have learners to invite employers in for too.
export default function ProviderGuestInvitesPage() {
  return <GuestInvitePanel />
}
