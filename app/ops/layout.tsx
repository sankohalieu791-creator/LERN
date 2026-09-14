'use client'

import { usePathname } from 'next/navigation'
import OpsGate from '@/components/v2/OpsGate'
import OpsShell from '@/components/v2/OpsShell'

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/ops/login'

  return (
    <OpsGate>
      {isLoginPage ? children : <OpsShell>{children}</OpsShell>}
    </OpsGate>
  )
}
