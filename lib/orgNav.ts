import { Home, ClipboardCheck, Users, FileText, BookOpen, Presentation, LayoutDashboard } from 'lucide-react'
import type { NavItem } from '@/components/v2/OrgShell'

// Institutions get Review and Students as their own sections (larger,
// people-heavy: many teachers reviewing many students, plus
// attendance). Providers review inside Dashboard instead — their
// operation is course-focused and tighter.
export const institutionSections: NavItem[] = [
  { key: 'feed',      label: 'Feed',      icon: Home,            href: '/institution/feed' },
  { key: 'review',    label: 'Review',    icon: ClipboardCheck,  href: '/institution/review' },
  { key: 'students',  label: 'Students',  icon: Users,           href: '/institution/students' },
  { key: 'briefs',    label: 'Briefs',    icon: FileText,        href: '/institution/briefs' },
  { key: 'workshops', label: 'Workshops', icon: Presentation,    href: '/institution/workshops' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/institution/dashboard' },
]

export const institutionPhoneItems: [NavItem, NavItem, NavItem] = [
  institutionSections[0], // Feed
  institutionSections[3], // Briefs
  institutionSections[5], // Dashboard
]

export const providerSections: NavItem[] = [
  { key: 'feed',      label: 'Feed',      icon: Home,            href: '/provider/feed' },
  { key: 'courses',   label: 'Courses',   icon: BookOpen,        href: '/provider/courses' },
  { key: 'workshops', label: 'Workshops', icon: Presentation,    href: '/provider/workshops' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/provider/dashboard' },
]

export const providerPhoneItems: [NavItem, NavItem, NavItem] = [
  providerSections[0], // Feed
  providerSections[1], // Courses
  providerSections[3], // Dashboard
]
