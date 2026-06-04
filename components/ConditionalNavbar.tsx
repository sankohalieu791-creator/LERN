'use client'

import { usePathname } from 'next/navigation'
import Navbar from './Navbar'

// Each page now has its own header — global navbar not needed anywhere
const FEED_ROUTES: string[] = []

export default function ConditionalNavbar() {
  const pathname = usePathname()
  const show = FEED_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  return show ? <Navbar /> : null
}
