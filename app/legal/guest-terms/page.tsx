'use client'

import LegalShell from '@/components/v2/LegalShell'

// A dedicated page for the guest employer link specifically -- not the
// full platform Terms of Service, which assumes an account. Reachable
// from the claim page (app/guest/[token]/page.tsx) before any session
// exists, same as every other LegalShell page.
export default function GuestTermsPage() {
  return (
    <LegalShell title="Terms for a shared-work link">
      <p className="text-[13px] text-ink-tertiary">Version 1.0, 10 September 2026</p>

      <p>
        You've been sent a link by an organisation using LERN to share a young person's verified work with you.
        This page explains exactly what that means. LERN is run by IRL Connect Ltd, trading as LERN. Contact:
        alieu@joinirl.co.uk.
      </p>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">What this link gives you</h2>
      <ul>
        <li>Access to exactly the piece(s) of verified work the organisation chose to share with you — nothing else.</li>
        <li>No account, no password, no sign-up. Confirming your name and email gets you a one-time link to view what was shared.</li>
        <li>No search, no browsing, no visibility of any other student, post, or content anywhere on LERN.</li>
      </ul>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">What you cannot do</h2>
      <ul>
        <li>You cannot contact the student directly. There is no path to their name in a way that lets you reach them, no email, no messaging.</li>
        <li>If you're interested in the student, "Express interest" sends that to the organisation, who decide how to take it forward. You never receive direct contact details.</li>
        <li>You cannot use this link to look up, identify, or attempt to contact the student outside LERN.</li>
      </ul>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Your own information</h2>
      <ul>
        <li>Your name and email are used only to send you this link and to let the organisation know who viewed what they shared.</li>
        <li>We don't use your details for marketing, and we don't share them beyond the organisation that invited you.</li>
      </ul>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Safeguarding</h2>
      <ul>
        <li>If the student is under 18, every safeguard on this platform still applies in full — the organisation remains responsible for them, and this link changes none of that.</li>
        <li>Any concern about how this link is being used should be reported to the organisation that sent it, or to LERN directly.</li>
      </ul>

      <p className="mt-6 pt-4 border-t border-edge-subtle text-[13px] text-ink-tertiary">
        These terms are governed by the law of England and Wales. See also the Privacy and Safeguarding pages.
      </p>
    </LegalShell>
  )
}
