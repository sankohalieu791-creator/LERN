import { Home, ClipboardCheck, Users, FileText, BookOpen, Presentation, LayoutDashboard, Briefcase, Search, Megaphone } from 'lucide-react'
import type { NavItem } from '@/components/v2/OrgShell'

// Review is its own section for both roles now — Job tracking too (not
// live yet, but reachable as its own place rather than buried as a card
// inside Dashboard).
export const institutionSections: NavItem[] = [
  { key: 'feed',      label: 'Feed',      icon: Home,            href: '/institution/feed' },
  { key: 'review',    label: 'Review',    icon: ClipboardCheck,  href: '/institution/review' },
  { key: 'students',  label: 'Students',  icon: Users,           href: '/institution/students' },
  { key: 'briefs',    label: 'Briefs',    icon: FileText,        href: '/institution/briefs' },
  { key: 'workshops', label: 'Workshops', icon: Presentation,    href: '/institution/workshops' },
  { key: 'jobs',      label: 'Job tracking', icon: Briefcase,    href: '/institution/jobs' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/institution/dashboard' },
]

export const institutionPhoneItems: [NavItem, NavItem, NavItem] = [
  institutionSections[0], // Feed
  institutionSections[3], // Briefs
  institutionSections[6], // Dashboard
]

export const providerSections: NavItem[] = [
  { key: 'feed',      label: 'Feed',      icon: Home,            href: '/provider/feed' },
  { key: 'review',    label: 'Review',    icon: ClipboardCheck,  href: '/provider/review' },
  { key: 'courses',   label: 'Courses',   icon: BookOpen,        href: '/provider/courses' },
  { key: 'workshops', label: 'Workshops', icon: Presentation,    href: '/provider/workshops' },
  { key: 'jobs',      label: 'Job tracking', icon: Briefcase,    href: '/provider/jobs' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/provider/dashboard' },
]

export const providerPhoneItems: [NavItem, NavItem, NavItem] = [
  providerSections[0], // Feed
  providerSections[2], // Courses
  providerSections[5], // Dashboard
]

// Employer sidebar per the build spec, in the given order — Discover
// first (browse verified work), Job Tracker before Opportunities in
// the sidebar reads oddly against the spec's prose order but the
// spec's own numbered build order is Discover -> Opportunities ->
// Job Tracker -> Briefs, so that's what's reflected here too.
export const employerSections: NavItem[] = [
  { key: 'discover',      label: 'Discover',      icon: Search,          href: '/employer/discover' },
  { key: 'opportunities', label: 'Opportunities',  icon: Megaphone,       href: '/employer/opportunities' },
  { key: 'job-tracker',   label: 'Job Tracker',    icon: Briefcase,       href: '/employer/job-tracker' },
  { key: 'briefs',        label: 'Briefs',         icon: FileText,        href: '/employer/briefs' },
  { key: 'dashboard',     label: 'Dashboard',      icon: LayoutDashboard, href: '/employer/dashboard' },
]

export const employerPhoneItems: [NavItem, NavItem, NavItem] = [
  employerSections[0], // Discover
  employerSections[1], // Opportunities
  employerSections[4], // Dashboard
]
