'use client'

import { useParams } from 'next/navigation'
import ProfilePanel from '@/components/v2/ProfilePanel'

// Tapping an author's name/avatar in Feed lands here -- the same
// ProfilePanel, in public (not own) view: top block, stats, and the
// three (now four, with Saved jobs) shopfront tiles, never Saved jobs'
// actual contents or Settings, which only ever render for isOwn.
export default function OtherStudentProfilePage() {
  const params = useParams<{ userId: string }>()
  return <ProfilePanel userId={params.userId} ownView={false} />
}
