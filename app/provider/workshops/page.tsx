'use client'

import WorkItemsPanel from '@/components/v2/WorkItemsPanel'

export default function ProviderWorkshopsPage() {
  return (
    <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6">
      <WorkItemsPanel type="workshop" />
    </div>
  )
}
