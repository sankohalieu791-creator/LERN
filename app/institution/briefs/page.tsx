'use client'

import WorkItemsPanel from '@/components/v2/WorkItemsPanel'

// No outer bg-surface/border/rounded-2xl box -- the whole screen sitting
// inside one bordered card was the same mistake made on the student
// Profile layout early on: a self-contained box floating in the page
// instead of just being the page. WorkItemsPanel already carries its
// own spacing; it flows directly in main now, same as Dashboard,
// Students, Interest received and Job tracking.
export default function InstitutionBriefsPage() {
  return <WorkItemsPanel type="brief" />
}
