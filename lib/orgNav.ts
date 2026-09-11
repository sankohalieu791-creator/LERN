import { Home, ClipboardCheck, Users, FileText, BookOpen, Presentation, LayoutDashboard, Briefcase, Search, Megaphone, HeartHandshake, Inbox, Building2, Bookmark, GraduationCap } from 'lucide-react'
import type { NavItem } from '@/components/v2/OrgShell'

// Institutions and providers are the SAME shell now -- one org layout,
// built here from one shared list, with a single section swapped
// (Briefs for institutions, Courses for providers -- a brief is set
// and verified by a tutor, a course is the provider-side equivalent
// unit of work). Everything else -- Review, Students (roster +
// attendance register + guest invites, all three tabs live inside
// StudentsPanel), Workshops, Interest received, Job tracking,
// Dashboard -- is identical for both, generated from the same array
// so the two navs structurally can't drift apart again the way
// providerSections missing Students did before this. extraBeforeDashboard
// is for a section that belongs to one kind only (Bootcamp Evidence,
// provider-only) without forking the whole list.
function buildOrgSections(kind: 'institution' | 'provider', extraBeforeDashboard: NavItem[] = []): NavItem[] {
  const base = `/${kind}`
  const workSection: NavItem = kind === 'institution'
    ? { key: 'briefs', label: 'Briefs', icon: FileText, href: `${base}/briefs` }
    : { key: 'courses', label: 'Courses', icon: BookOpen, href: `${base}/courses` }

  return [
    { key: 'feed',      label: 'Feed',      icon: Home,            href: `${base}/feed` },
    { key: 'review',    label: 'Review',    icon: ClipboardCheck,  href: `${base}/review` },
    { key: 'students',  label: 'Students',  icon: Users,           href: `${base}/students` },
    workSection,
    { key: 'workshops', label: 'Workshops', icon: Presentation,    href: `${base}/workshops` },
    { key: 'interest',  label: 'Interest received', icon: HeartHandshake, href: `${base}/interest` },
    { key: 'jobs',      label: 'Job tracking', icon: Briefcase,    href: `${base}/jobs` },
    ...extraBeforeDashboard,
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: `${base}/dashboard` },
  ]
}

export const institutionSections: NavItem[] = buildOrgSections('institution')
export const institutionPhoneItems: [NavItem, NavItem, NavItem] = [
  institutionSections[0], // Feed
  institutionSections[3], // Briefs
  institutionSections[7], // Dashboard
]

// Bootcamp Evidence -- Charles Booth-call selling feature, provider
// only. Its own sidebar item per spec, not folded into Dashboard or
// Students.
export const providerSections: NavItem[] = buildOrgSections('provider', [
  { key: 'bootcamp-evidence', label: 'Bootcamp Evidence', icon: GraduationCap, href: '/provider/bootcamp-evidence' },
])
export const providerPhoneItems: [NavItem, NavItem, NavItem] = [
  providerSections[0], // Feed
  providerSections[3], // Courses
  providerSections[8], // Dashboard
]

// Independent employer sidebar -- corrected per direct feedback: Briefs
// removed entirely (a brief is a teaching-and-verifying tool -- tutors
// set and verify it, employers don't; an employer wanting a work
// sample asks for one inside the Job post or the interest request
// instead). That removal stands. Talent pools is back -- verified
// working end to end (talent_pools/talent_pool_members tables, RLS,
// and both halves of the UI: create/view/delete pools here, save a
// candidate into one from the bookmark button on Discover) before
// relinking it, not just re-added blind.
// Feed removed per the Michael Sep-10 review: an employer, guest or
// vetted, has no organisation of their own to scope a feed to, and the
// underlying posts_feed RLS treated "not hidden" as visible to
// literally any authenticated role regardless of org -- an employer
// (or a guest link) landing here saw every organisation's posts, which
// is exactly the "guest link opens the full feed" bug he found.
// Discover (verified public work, individually vetted per row) is the
// only browsing surface an employer is meant to have at all.
export const employerSections: NavItem[] = [
  { key: 'discover',      label: 'Discover',     icon: Search,          href: '/employer/discover' },
  { key: 'jobs',          label: 'Jobs',         icon: Megaphone,       href: '/employer/opportunities' },
  { key: 'candidates',    label: 'Candidates',   icon: Briefcase,       href: '/employer/candidates' },
  { key: 'inbox',         label: 'Inbox',        icon: Inbox,           href: '/employer/inbox' },
  { key: 'talent-pools',  label: 'Talent pools', icon: Bookmark,        href: '/employer/talent-pools' },
  { key: 'partners',      label: 'Partners',     icon: Building2,       href: '/employer/partners' },
  { key: 'dashboard',     label: 'Dashboard',    icon: LayoutDashboard, href: '/employer/dashboard' },
]

export const employerPhoneItems: [NavItem, NavItem, NavItem] = [
  employerSections[0], // Discover
  employerSections[2], // Candidates
  employerSections[6], // Dashboard
]
