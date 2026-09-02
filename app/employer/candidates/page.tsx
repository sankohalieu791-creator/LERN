'use client'

import { useAuth } from '@/context/AuthContext'
import JobTrackerBoard from '@/components/v2/JobTrackerBoard'

export default function EmployerCandidatesPage() {
  const { user } = useAuth()
  if (!user) return null
  return <JobTrackerBoard viewer="employer" employerId={user.id} />
}
