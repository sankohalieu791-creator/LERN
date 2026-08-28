'use client'

import WorkItemsPanel from '@/components/v2/WorkItemsPanel'

export default function ProviderWorkshopsPage() {
  return (
    <div className="bg-surface border border-edge rounded-2xl p-6">
      <WorkItemsPanel type="workshop" />
    </div>
  )
}
