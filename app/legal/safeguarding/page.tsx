'use client'

import LegalShell from '@/components/v2/LegalShell'
import { useAuth } from '@/context/AuthContext'

// Same source doc and same role-gating approach as
// app/legal/privacy/page.tsx -- see the comment there. This page
// carries the "Safeguarding" and "Reporting on the feed" sections;
// Reporting on the feed has no per-role split in the source, so it's
// shown to everyone as written.
export default function SafeguardingPage() {
  const { user } = useAuth()
  const role = user?.role

  return (
    <LegalShell title="Safeguarding">
      <p className="text-[13px] text-ink-tertiary">Version 1.0, 1 September 2026</p>

      <p>Keeping young people safe is the foundation of LERN, not an add-on. This page sets out what LERN does and what each user must do.</p>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">What LERN does for everyone</h2>
      <ul>
        <li>Under-18s are not publicly searchable or identifiable as people.</li>
        <li>No direct contact with a young person: no comments, no direct messages, reactions only, and those positive only.</li>
        <li>Employer interest in an under-18 always routes through the organisation, never straight to the young person.</li>
        <li>A gated feed, content reporting, auto-hide pending review, and human decisions on every report.</li>
        <li>An honest statement of which controls are live and which are being finished.</li>
      </ul>

      {(role === 'student' || !role) && (
        <>
          <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">For students</h2>
          <ul>
            <li>Your profile is private and you cannot be searched for by name while you are under 18.</li>
            <li>No one can message or contact you directly.</li>
            <li>If an employer is interested in you, it goes to your school first, never straight to you.</li>
            <li>Reactions are positive only. There is no dislike.</li>
            <li>You can report anything that worries you, and a real person will look at it.</li>
            <li>If you are ever in danger, tell a trusted adult at your school or call the emergency services.</li>
          </ul>
        </>
      )}

      {(role === 'institution_staff' || role === 'provider_staff' || !role) && (
        <>
          <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">For institutions and training providers</h2>
          <ul>
            <li>Name a safeguarding lead and keep the role up to date.</li>
            <li>Your lead receives routed employer interest and safeguarding alerts about your young people.</li>
            <li>Manage access and consent for your young people, and revoke access when someone leaves.</li>
            <li>Follow your own safeguarding duties, including Keeping Children Safe in Education and your LADO route where it applies.</li>
            <li>You are the intermediary for any employer contact about an under-18.</li>
          </ul>
        </>
      )}

      {(role === 'employer' || !role) && (
        <>
          <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">For employers</h2>
          <ul>
            <li>Never contact an under-18 directly. All contact and coordination go through the organisation.</li>
            <li>Do not attempt to identify, search for, or reach an under-18 outside the platform's routed process.</li>
            <li>Keep young people's information confidential and use it only for the opportunity.</li>
            <li>Report any concern through the platform. Serious concerns are escalated to the organisation's safeguarding lead.</li>
          </ul>
        </>
      )}

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Reporting on the feed</h2>
      <p>Anyone can report a post that worries them. Here is exactly what happens, so it is clear and fair to everyone.</p>

      <p className="font-semibold text-ink mt-3">How it works</p>
      <ul>
        <li>Tap report on any post, choose a plain reason, and add a note if you want.</li>
        <li>The post is hidden automatically while it is checked. This protects people first; it is not a decision against the person who posted.</li>
        <li>A member of safeguarding staff reviews the report and decides to restore the post or remove it.</li>
        <li>Nothing is decided automatically against a user; a person always makes the decision.</li>
        <li>Serious concerns are escalated to the organisation's safeguarding lead, who follows their own process.</li>
      </ul>

      <p className="font-semibold text-ink mt-3">What we ask of everyone</p>
      <ul>
        <li>Report honestly, to keep the space safe, not to target someone.</li>
        <li>Reactions are positive only, so the feed cannot become a place to pile on.</li>
      </ul>

      <p className="mt-6 pt-4 border-t border-edge-subtle text-[13px] text-ink-tertiary">
        Contact for all: alieu@joinirl.co.uk. Concerns can also go to the Information Commissioner's Office (ICO).
      </p>
    </LegalShell>
  )
}
