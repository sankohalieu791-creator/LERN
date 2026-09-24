import { UserPlus, FileText, ClipboardCheck, ShieldCheck, Megaphone, Heart, Bookmark, MessageCircle, LucideIcon } from 'lucide-react'

export type ChecklistRole = 'institution' | 'provider' | 'employer'

export type ChecklistItem = {
  key: string // matches a boolean field on the progress RPC's response
  label: string
  hint: string
  icon: LucideIcon
}

// One real, detectable action per item -- checked off from actual data
// (get_org_onboarding_progress / get_employer_onboarding_progress), never
// from clicking "next" on a slide. Institution and provider share the
// same four tasks (same underlying tables); employer's are its own.
const ORG_ITEMS: ChecklistItem[] = [
  { key: 'has_safeguarding_lead', label: 'Set your safeguarding lead', hint: "You're the lead by default — confirm or reassign it in Settings.", icon: ShieldCheck },
  { key: 'has_student', label: 'Invite your first student', hint: 'Generate a join code from your Dashboard and share it.', icon: UserPlus },
  { key: 'has_work_item', label: 'Set your first Brief or Course', hint: 'Give students something real to work on.', icon: FileText },
  { key: 'has_review', label: 'Review a submission', hint: 'Verify or return one piece of submitted work.', icon: ClipboardCheck },
]

const EMPLOYER_ITEMS: ChecklistItem[] = [
  { key: 'has_job', label: 'Post your first job', hint: 'Get a role in front of verified candidates.', icon: Megaphone },
  { key: 'has_interest', label: 'Show interest in a candidate', hint: 'Browse Discover and flag someone promising.', icon: Heart },
  { key: 'has_pool_member', label: 'Save a candidate to a Talent pool', hint: "LERN keeps them warm automatically from there.", icon: Bookmark },
  { key: 'has_message', label: 'Send your first message', hint: "Reply to a candidate's school or training provider.", icon: MessageCircle },
]

export function checklistItemsFor(role: ChecklistRole): ChecklistItem[] {
  return role === 'employer' ? EMPLOYER_ITEMS : ORG_ITEMS
}

export const CHECKLIST_TITLE: Record<ChecklistRole, string> = {
  institution: 'Get your school set up',
  provider: 'Get your organisation set up',
  employer: 'Get set up on LERN',
}
