'use client'

import LegalShell from '@/components/v2/LegalShell'

export default function SafeguardingPage() {
  return (
    <LegalShell title="Safeguarding">
      <p>LERN's full safeguarding policy is being finalised and will appear here before the app opens beyond testing. What's built and enforced today:</p>
      <ul>
        <li>Every review of a student's work is logged, append-only, and visible to that organisation's named safeguarding lead.</li>
        <li>No employer or outside adult can contact a young person directly through LERN — anything they want to say is routed through the student's organisation first.</li>
        <li>Under-18s' verified work is only ever visible within their own organisation, never made public, unless they turn 18 and actively choose otherwise.</li>
        <li>You can raise a concern about content or a person at any time from Settings. A human reviews every report — never an automated ban. A concern about an adult at LERN follows the independent route, not your organisation's own staff.</li>
      </ul>
    </LegalShell>
  )
}
