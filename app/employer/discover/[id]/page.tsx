'use client'

import { useParams } from 'next/navigation'
import CandidateDetailPanel from '@/components/v2/CandidateDetailPanel'

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>()
  return <CandidateDetailPanel studentId={params.id} />
}
