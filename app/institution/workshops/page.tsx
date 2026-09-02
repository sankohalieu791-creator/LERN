'use client'

import WorkItemsPanel from '@/components/v2/WorkItemsPanel'

export default function InstitutionWorkshopsPage() {
  return (
    <div className="max-w-3xl mx-auto bg-surface border border-edge rounded-2xl p-6">
      <WorkItemsPanel type="workshop" />
    </div>
  )
}
