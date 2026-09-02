'use client'

import { useAuth } from '@/context/AuthContext'
import JobTrackerBoard from '@/components/v2/JobTrackerBoard'

export default function ProviderJobsPage() {
  const { user } = useAuth()
  if (!user?.organisation_id) return null
  return <JobTrackerBoard viewer="org" organisationId={user.organisation_id} />
}
