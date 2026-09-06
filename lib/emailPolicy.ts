// Per-role email rules for signup. This is a heuristic, not real
// verification — there is no universal way to confirm "this domain
// belongs to a school" or "this domain belongs to a real employer"
// from an email address alone. What this DOES reliably catch: someone
// using a personal inbox (Gmail, Outlook, iCloud, etc.) where the role
// requires an organisational one. It will not catch someone who
// registers a domain that merely looks institutional/corporate — that
// requires a human review step, not a client-side check, and is a
// separate piece of work from this.
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.ca', 'yahoo.fr', 'yahoo.de', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.co.uk', 'live.com', 'live.co.uk', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'aol.co.uk',
  'protonmail.com', 'proton.me', 'pm.me',
  'gmx.com', 'gmx.co.uk', 'gmx.net', 'gmx.de',
  'mail.com', 'email.com', 'inbox.com',
  'zoho.com',
  'yandex.com', 'yandex.ru',
  'tutanota.com', 'tutanota.de', 'tuta.io',
  'fastmail.com',
  'hey.com',
])

export function isPersonalEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1]
  if (!domain) return false
  return PERSONAL_EMAIL_DOMAINS.has(domain)
}

// Institutions (schools/colleges) — school email only, no exceptions.
// Providers are deliberately not gated here — optional/lenient, per
// the same distinction the product already draws between the two org
// types elsewhere.
export function institutionEmailError(email: string): string | null {
  if (isPersonalEmailDomain(email)) {
    return 'Use your school or college email address — personal email addresses (like Gmail, Outlook or iCloud) aren’t accepted for a school or college account.'
  }
  return null
}

// Employers — work email only, no personal inbox.
export function employerEmailError(email: string): string | null {
  if (isPersonalEmailDomain(email)) {
    return 'Use your work email address — personal email addresses (like Gmail, Outlook or iCloud) aren’t accepted for an employer account.'
  }
  return null
}
