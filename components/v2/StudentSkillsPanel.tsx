'use client'

import { useAuth } from '@/context/AuthContext'
import { SkillsFolderContent } from '@/components/v2/ProfilePanel'

// The laptop-only "My Skill" destination -- per direct request, a real
// sidebar button rather than a tab buried inside Profile. Same content
// ProfilePanel's own Skills folder used to render for your own
// profile (org-set skills + self-reported, with evidence), just given
// its own page now. Phone reaches the exact same content a different
// way -- a tab inside My Work (StudentMyWorkPanel.tsx) -- not through
// this route at all.
export default function StudentSkillsPanel() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="px-4 pt-4 pb-10">
      <h1 className="text-[var(--app-text)] text-[20px] font-semibold">My Skill</h1>
      <p className="text-[13px] mt-0.5 mb-5" style={{ color: 'var(--app-text-secondary)' }}>
        Skills your organisation has set, plus any you've added yourself with evidence.
      </p>
      <SkillsFolderContent profileId={user.id} organisationId={user.organisation_id} isOwn={true} />
    </div>
  )
}
