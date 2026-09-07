'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

// Reachable from settings and sign-up without being logged in — no
// RoleGate, no shell chrome tied to a role.
//
// Used to show the full LERN logo up here, same as AuthShell's header.
// That was wrong for how this screen actually gets reached in
// practice: nearly every visit is a tap from a plain settings list
// (Data Protection / Cookie Policy / Terms), which has no logo of its
// own at all -- jumping into a page that suddenly does felt like the
// whole app had reloaded ("it's like a reset, then the logo comes
// up"), even though it was just a normal in-app navigation the whole
// time. Every other settings sub-screen (ScreenShell, both the
// student and org versions) is just a back arrow and a title, no
// logo -- this now matches that same, lighter pattern instead of
// standing out as its own separate "app" moment.
export default function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter()
  return (
    // paddingTop: env(safe-area-inset-top) -- so on a standalone PWA
    // the header sits clear of the status bar overlay.
    <div className="min-h-screen bg-paper" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="flex items-center px-6 lg:px-10 py-6">
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
