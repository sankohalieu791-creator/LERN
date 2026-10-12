'use client'

import StudentMyWorkPanel from '@/components/v2/StudentMyWorkPanel'

// Was a My Work / My Skill Wallet tab switcher on phone (desktop got
// Skill Wallet as its own sidebar item instead). Both now consolidate
// onto the Profile screen's 'skills' tab instead, so this container's
// only job left is rendering My Work -- kept as its own file/route
// rather than inlining StudentMyWorkPanel directly at the call site,
// in case phone ever needs a wrapper here again.
export default function StudentWorkContainer() {
  return <StudentMyWorkPanel />
}
