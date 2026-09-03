'use client'

import LegalShell from '@/components/v2/LegalShell'
import { useAuth } from '@/context/AuthContext'

// Same source-doc pattern as app/legal/privacy and app/legal/safeguarding
// -- one file covering all four user types, but each role only ever
// sees its own "Terms for X" section on top of the shared rules.
// Institutions and providers share one section (the source doc itself
// says the only difference between them is Briefs vs Courses).
export default function TermsPage() {
  const { user } = useAuth()
  const role = user?.role

  return (
    <LegalShell title="Terms of Service">
      <p className="text-[13px] text-ink-tertiary">Version 1.0, 2 September 2026</p>

      <p>
        These terms are the rules for using LERN: what you can and cannot do, who owns what, and the limits of the
        service. They sit alongside the Privacy, Data Protection, and Safeguarding pages, which cover data and
        safety. LERN is run by IRL Connect Ltd, trading as LERN. Contact: alieu@joinirl.co.uk.
      </p>
      <p>
        By using LERN you agree to these terms. If you do not agree, do not use the service. These terms are
        governed by the law of England and Wales.
      </p>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Using LERN</h2>
      <ul>
        <li>Use LERN lawfully and as it is meant to be used.</li>
        <li>Do not misuse, disrupt, or try to break the platform's security or access controls.</li>
        <li>Do not post harmful, hateful, illegal, or inappropriate content.</li>
        <li>Do not try to contact young people outside the platform's rules, or get around its safeguarding routing.</li>
      </ul>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Your account</h2>
      <ul>
        <li>Keep your login details private, and tell us of any unauthorised use.</li>
        <li>You are responsible for what happens on your account.</li>
        <li>We may suspend or remove an account that breaks these terms or the safeguarding rules.</li>
      </ul>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Content and ownership</h2>
      <ul>
        <li>You own the content and work you create. You give LERN the permissions needed to show and run the service.</li>
        <li>Verified work shows that a young person's organisation has reviewed it; the work belongs to the young person.</li>
        <li>Do not claim work that is not yours, or pretend to be someone else.</li>
      </ul>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">The service and its limits</h2>
      <ul>
        <li>We provide LERN with reasonable care and skill, and improve it over time.</li>
        <li>Some features are still being built; we say clearly what is live and what is coming.</li>
        <li>To the extent the law allows, we are not liable for indirect or unforeseeable loss. Nothing here limits liability where it cannot lawfully be limited.</li>
        <li>We carry insurance cover appropriate to the service.</li>
      </ul>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Changes</h2>
      <p>We may update these terms; we will tell you about important changes. Continuing to use LERN means you accept the current version.</p>

      {(role === 'student' || !role) && (
        <>
          <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Terms for students</h2>
          <p className="text-[13px] text-ink-tertiary mb-2">These apply to young people using LERN through their school, college, or provider.</p>
          <p className="font-semibold text-ink mt-3">Using LERN</p>
          <ul>
            <li>You join through your organisation with a code, and keep your login to yourself.</li>
            <li>Be kind and respectful. No bullying, and no harmful or inappropriate content.</li>
            <li>Post your own work, and do not claim work that is not yours.</li>
            <li>Self-added qualifications are shown as self-added, and are not the same as verified work.</li>
          </ul>
          <p className="font-semibold text-ink mt-3">What you can expect</p>
          <ul>
            <li>Your profile is private and you are not publicly searchable while you are under 18.</li>
            <li>No one can contact you directly; employer interest goes through your organisation.</li>
            <li>Reactions are positive only. You can report anything that worries you, and a person will look at it.</li>
            <li>Your verified work belongs to you and travels with your profile.</li>
          </ul>
          <p className="font-semibold text-ink mt-3">If you are 18 or over</p>
          <p>You can choose to be more visible and to receive and respond to employer interest more directly. The same rules on respect and honesty apply.</p>
        </>
      )}

      {(role === 'institution_staff' || role === 'provider_staff' || !role) && (
        <>
          <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Terms for institutions and training providers</h2>
          <p className="text-[13px] text-ink-tertiary mb-2">These apply to schools, colleges, and training providers that bring young people onto LERN.</p>
          <p className="font-semibold text-ink mt-3">Your responsibilities</p>
          <ul>
            <li>You bring young people on through your own codes, and manage who has access.</li>
            <li>You name a safeguarding lead who receives routed employer interest and safeguarding alerts.</li>
            <li>Your own staff review and verify your students' work; verification is your judgement against the brief's criteria.</li>
            <li>You obtain the appropriate consents for young people to use LERN, in line with your existing duties.</li>
            <li>You handle employer contact about your young people, and decide what to accept or decline.</li>
            <li>You keep your staff list and codes up to date, and revoke access when someone leaves.</li>
          </ul>
          <p className="font-semibold text-ink mt-3">What LERN provides</p>
          <ul>
            <li>The platform to set and verify work, build verified profiles, and route employer interest safely.</li>
            <li>Safeguarding by design: institution-only access for under-18s, no direct contact, a gated feed, and reporting.</li>
            <li>A clear statement of what is live and what is being built.</li>
          </ul>
          <p className="font-semibold text-ink mt-3">Fees</p>
          <p>Fees are as set out in your service agreement with LERN. Founding and early-partner terms are as agreed in writing.</p>
          <p className="text-[13px] text-ink-tertiary mt-2">The only difference between an institution and a provider in these terms is that institutions set Briefs and providers run Courses. Everything else is the same.</p>
        </>
      )}

      {(role === 'employer' || !role) && (
        <>
          <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Terms for employers</h2>
          <p className="text-[13px] text-ink-tertiary mb-2">These apply to employers who use LERN to discover verified talent and express interest in young people. Employer accounts are invite-only.</p>
          <p className="font-semibold text-ink mt-3">Your responsibilities</p>
          <ul>
            <li>Use LERN to view verified work and express interest through the proper routes.</li>
            <li>For any young person under 18, never contact them directly; all contact goes through their organisation.</li>
            <li>Do not try to identify, search for, or reach an under-18 outside the platform's routed process.</li>
            <li>Keep any information you see about a young person confidential, and use it only for the opportunity.</li>
            <li>Post only genuine, lawful opportunities, and keep your job posts and pipeline stages accurate.</li>
            <li>Treat young people fairly and without discrimination.</li>
          </ul>
          <p className="font-semibold text-ink mt-3">What LERN provides</p>
          <ul>
            <li>Access to browse verified talent, post opportunities, and manage candidates through a pipeline.</li>
            <li>A safe, routed way to express interest, with under-18 contact always mediated by the organisation.</li>
            <li>Tools to track hiring and see the partner organisations you work through.</li>
          </ul>
          <p className="font-semibold text-ink mt-3">Limits</p>
          <ul>
            <li>LERN verifies that work has been reviewed by the young person's organisation. LERN does not guarantee a young person's suitability for a role; hiring decisions and checks are yours.</li>
            <li>Access can be suspended or withdrawn if these terms or the safeguarding rules are breached.</li>
          </ul>
        </>
      )}

      <p className="mt-6 pt-4 border-t border-edge-subtle text-[13px] text-ink-tertiary">
        Contact: alieu@joinirl.co.uk. Concerns can also go to the Information Commissioner's Office (ICO).
      </p>
    </LegalShell>
  )
}
