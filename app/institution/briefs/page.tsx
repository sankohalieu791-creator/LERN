'use client'

import WorkItemsPanel from '@/components/v2/WorkItemsPanel'

export default function InstitutionBriefsPage() {
  return (
    <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6 max-w-3xl">
      <WorkItemsPanel type="brief" />
    </div>
  )
}
