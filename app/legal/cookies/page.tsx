'use client'

import LegalShell from '@/components/v2/LegalShell'

export default function CookiesPage() {
  return (
    <LegalShell title="Cookie Policy">
      <p className="text-[13px] text-ink-tertiary">Version 1.0, 1 September 2026</p>

      <p>
        This page explains what LERN stores on your device and why. LERN is run by IRL Connect Ltd, trading as
        LERN.
      </p>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Essential — always on</h2>
      <p>These keep the app working and can't be switched off, in the same way a website can't function without knowing you're logged in.</p>
      <ul>
        <li>Signing you in and keeping you signed in, so you're not asked to log in again on every screen.</li>
        <li>Remembering your choices — like your light/dark/system theme preference.</li>
        <li>Basic security checks that protect your account and stop abuse.</li>
      </ul>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Performance — always on, but not identifying you</h2>
      <p>
        LERN uses Vercel Analytics and Speed Insights to see how the app is used and where it runs slowly, so we
        can improve it. These don't use cookies and don't build a profile of you — they measure page views and load
        times, not who you are.
      </p>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Optional analytics cookies</h2>
      <p>
        Beyond the above, LERN does not currently set any optional analytics or advertising cookies. The
        "Analytics cookies" toggle in Settings → About and legal is there for if that ever changes — it's off by
        default, and switching it on or off never affects whether you can use LERN.
      </p>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">What LERN never does</h2>
      <ul>
        <li>No advertising or marketing cookies.</li>
        <li>No selling or sharing your browsing activity with third parties.</li>
        <li>No cross-site tracking — nothing here follows you to other websites or apps.</li>
      </ul>

      <p className="mt-6 pt-4 border-t border-edge-subtle text-[13px] text-ink-tertiary">
        Questions about this policy: alieu@joinirl.co.uk. Concerns can also go to the Information Commissioner's Office (ICO).
      </p>
    </LegalShell>
  )
}
