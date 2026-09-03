'use client'

import LegalShell from '@/components/v2/LegalShell'
import { useAuth } from '@/context/AuthContext'

// LERN Data Protection and Safeguarding, All Users -- v1.0, 1 September
// 2026. Source doc combines all four user types into one file, written
// so the shared "Data protection" content stays common but each role
// only ever sees ITS OWN "For X" section -- a student never sees
// employer-only duties, an employer never sees provider-only duties,
// and institutions/providers share one section because the source
// document itself treats them identically (same controller/processor
// relationship, same safeguarding-lead structure) rather than
// inventing a split that isn't in the real text.
//
// Gated on user.role, read live -- not a static per-route page, since
// every role reaches this same /legal/privacy link from their own
// Settings screen. Logged-out/unknown role (session still loading,
// or reached before sign-in) falls back to showing every "For X"
// section rather than guessing wrong or showing none.
export default function PrivacyPage() {
  const { user } = useAuth()
  const role = user?.role

  return (
    <LegalShell title="Data Protection">
      <p className="text-[13px] text-ink-tertiary">Version 1.0, 1 September 2026</p>

      <p>
        How LERN meets its duties under UK GDPR and the Data Protection Act 2018. LERN is run by IRL Connect Ltd,
        trading as LERN. Data is held in the UK.
      </p>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">Who is responsible for what</h2>
      <ul>
        <li>For young people under 18, their school, college, or provider is the data controller. LERN processes their data on the organisation's behalf and on its instructions.</li>
        <li>For adult users (organisation staff and employers), LERN is the controller for their account information.</li>
      </ul>

      <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">How data is protected</h2>
      <ul>
        <li>Held in the UK.</li>
        <li>Access limited to named, authorised people.</li>
        <li>Under-18s are not publicly searchable or identifiable as people.</li>
        <li>Security measures suited to holding young people's data, backed by insurance cover.</li>
        <li>Kept only as long as needed to provide the service or meet a legal duty.</li>
        <li>Never sold, and shared only where needed to run the service.</li>
      </ul>

      {(role === 'student' || !role) && (
        <>
          <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">For students</h2>
          <ul>
            <li>You joined through your school, and they look after your information with us.</li>
            <li>You can see a copy of your data, correct it, or ask to delete it.</li>
            <li>If you are under 18 and want to delete your data, we let your school know so the right adult can help.</li>
            <li>You can ask us anything at alieu@joinirl.co.uk, or complain to the ICO.</li>
          </ul>
        </>
      )}

      {(role === 'institution_staff' || role === 'provider_staff' || !role) && (
        <>
          <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">For institutions and training providers</h2>
          <ul>
            <li>You are the data controller for your young people; LERN is your processor and acts on your instructions.</li>
            <li>You obtain the appropriate consents for your young people to use LERN, in line with your existing duties.</li>
            <li>You manage access, and can export or request deletion of your data.</li>
            <li>A data processing schedule sets out exactly how LERN handles your students' data.</li>
          </ul>
        </>
      )}

      {(role === 'employer' || !role) && (
        <>
          <h2 className="text-[15px] font-bold text-ink mt-6 mb-2">For employers</h2>
          <ul>
            <li>LERN is the controller for your account information.</li>
            <li>You see only what you are allowed to see: verified work and, for under-18s, only through the organisation.</li>
            <li>You keep any information you see about a young person confidential and use it only for the opportunity.</li>
            <li>You do not export, copy, or reuse young people's data outside the platform's proper use.</li>
          </ul>
        </>
      )}

      <p className="mt-6 pt-4 border-t border-edge-subtle text-[13px] text-ink-tertiary">
        Contact for all: alieu@joinirl.co.uk. Concerns can also go to the Information Commissioner's Office (ICO).
      </p>
    </LegalShell>
  )
}
