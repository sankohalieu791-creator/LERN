'use client'

import { useRouter } from 'next/navigation'
import Logo from '@/components/v2/Logo'
import { ArrowLeft } from 'lucide-react'

// Reachable from settings and sign-up without being logged in — no
// RoleGate, no shell chrome tied to a role.
export default function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter()
  return (
    // paddingTop: env(safe-area-inset-top) -- missing entirely before,
    // so on a standalone PWA the header sat right at the true top edge
    // of the screen, under the status bar overlay ("the logo is all
    // the way up"). Every other full-screen shell in the app already
    // does this; this one just never had it.
    <div className="min-h-screen bg-paper" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="flex items-center justify-between px-6 lg:px-10 py-6">
        <Logo />
        {/* router.back() -- not a hardcoded href="/". That sent a
            logged-in student who tapped this from Settings out to the
            marketing root, which then redirects them back into the
            app but drops them at Feed, not wherever they actually
            came from. Real browser history returns them to the exact
            screen they left. */}
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-ink transition">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </header>
      <main className="max-w-2xl mx-auto px-6 pb-20">
        <h1 className="text-2xl font-bold text-ink mb-6">{title}</h1>
        <div className="space-y-4 text-[14px] text-ink-body leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2">
          {children}
        </div>
      </main>
    </div>
  )
}
