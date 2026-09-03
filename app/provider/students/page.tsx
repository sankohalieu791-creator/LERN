'use client'

import StudentsPanel from '@/components/v2/StudentsPanel'

// Same component institution uses -- roster, attendance register, and
// guest invites all live inside StudentsPanel, and it's driven entirely
// by the signed-in staff member's own organisation_id, nothing
// institution-specific hardcoded. Providers have learners too.
export default function ProviderStudentsPage() {
  return <StudentsPanel />
}
