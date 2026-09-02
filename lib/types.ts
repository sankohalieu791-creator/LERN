// v2 schema types — see supabase/migrations/2026-08-26-rebuild-schema-v2.sql
// onward for the source of truth. Every user is exactly one role; the
// role decides what they can see and do (enforced in RLS, not here).

export type Role = 'student' | 'institution_staff' | 'provider_staff' | 'employer'
export type OrgType = 'institution' | 'provider'

export type ReactionType = 'congratulations' | 'well_done' | 'keep_going' | 'thumbs_up' | 'celebrate_lern'

export interface Post {
  id: string
  organisation_id: string
  author_id: string
  content?: string
  image_path?: string
  visibility: 'organisation' | 'public'
  created_at: string
}

export interface User {
  id: string
  role: Role
  full_name: string
  email: string
  date_of_birth?: string
  organisation_id?: string
  group_id?: string
  sidebar_collapsed?: boolean
  consented_at?: string
  theme_preference?: 'light' | 'dark' | 'system'
  presence_status?: 'active' | 'busy' | 'away'
  notification_prefs?: Record<string, boolean>
  is_guest?: boolean
  guest_invite_id?: string
  is_demo_gateway?: boolean
  bio?: string
  interest_tags?: string[]
  avatar_path?: string
  // Privacy — only ever meaningfully settable for an 18+ account; an
  // under-18's row stays at these safe defaults (public_profile false)
  // and Settings never renders a control to change them.
  public_profile?: boolean
  work_public_default?: boolean
  followers_visible?: boolean
  following_visible?: boolean
  two_step_enabled?: boolean
  cookie_consent?: { essential: true; analytics: boolean; consented_at: string }
  created_at: string
}

export interface Report {
  id: string
  reporter_id?: string
  organisation_id?: string
  target_type: 'post' | 'user' | 'submission' | 'general'
  target_id?: string
  reason: string
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned'
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
}

export interface Group {
  id: string
  organisation_id: string
  name: string
  created_by?: string
  created_at: string
}

export interface Organisation {
  id: string
  name: string
  type: OrgType
  safeguarding_lead_id?: string
  created_at: string
}

// Student/employer-safe: name only, never `type` — matches the
// organisations_public view (org type is never shown to students).
export interface OrganisationPublic {
  id: string
  name: string
}

export interface JoinCode {
  id: string
  organisation_id: string
  code: string
  expires_at?: string
  revoked: boolean
  used_count: number
  created_by?: string
  created_at: string
}

export interface WorkItem {
  id: string
  organisation_id: string
  type: 'brief' | 'course' | 'workshop' | 'assignment'
  title: string
  description?: string
  topic?: string
  assignment?: string
  deadline?: string
  group_id?: string
  mode?: 'online' | 'in_person'
  location?: string
  starts_at?: string
  started_at?: string
  ended_at?: string
  closed_at?: string
  criteria: string
  visibility: 'public' | 'private'
  level?: 'beginner' | 'intermediate' | 'advanced'
  duration_label?: string
  publish_state?: 'draft' | 'scheduled' | 'posted'
  scheduled_for?: string
  created_by?: string
  created_at: string
}

export interface WorkItemAttachment {
  id: string
  work_item_id: string
  file_path: string
  file_name: string
  file_size_bytes?: number
  uploaded_by?: string
  created_at: string
}

export type AttendanceStatus = 'present' | 'absent' | 'late'

export interface AttendanceRecord {
  id: string
  group_id: string
  student_id: string
  session_date: string
  status: AttendanceStatus
  marked_by?: string
  created_at: string
  updated_at: string
}

export interface Enrolment {
  id: string
  student_id: string
  work_item_id: string
  joined_at: string
}

export type SubmissionStatus = 'submitted' | 'returned' | 'verified' | 'revoked'
export type ModerationStatus = 'clear' | 'flagged' | 'hidden'

export interface Submission {
  id: string
  student_id: string
  work_item_id: string
  content?: string
  file_path?: string
  file_type?: string
  file_size_bytes?: number
  moderation_status: ModerationStatus
  flagged_reason?: string
  status: SubmissionStatus
  submitted_at: string
  users?: User
  work_items?: WorkItem
}

export type ReviewDecision = 'verified' | 'returned' | 'revoked'

export interface Review {
  id: string
  submission_id: string
  reviewer_id: string
  feedback?: string
  decision: ReviewDecision
  created_at: string
  users?: User
}

export type ShareVisibility = 'organisation' | 'public'

export interface Verification {
  id: string
  submission_id: string
  verified_by: string
  verified_at: string
  visibility: ShareVisibility
  revoked_at?: string
  revoked_by?: string
  revocation_reason?: string
  users?: User
}

export interface Opportunity {
  id: string
  employer_id: string
  title: string
  description?: string
  created_at: string
}

export type InterestStatus = 'pending' | 'accepted' | 'declined'

export interface Interest {
  id: string
  employer_id: string
  student_id: string
  status: InterestStatus
  org_notified_at?: string
  created_at: string
}

export type NotificationType = 'submission_received' | 'work_returned' | 'work_verified' | 'work_revoked'

export interface AppNotification {
  id: string
  user_id: string
  type: NotificationType
  submission_id?: string
  read: boolean
  created_at: string
}
