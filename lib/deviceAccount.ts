// Remembers, per device/browser, that a real account has signed in
// here before -- deliberately outlives sign-out (never cleared by it).
// The root page (app/page.tsx) reads this to decide whether a logged-
// out visit means "brand new, send them to sign up" or "this device
// has an account, send them to log in instead". Without it, a PWA/
// home-screen icon (which always opens at "/") sent every logged-out
// visit to the sign-up role-chooser regardless of whether the person
// had an account and had just logged out of it moments earlier.
const KEY = 'lern_has_account'

export function markHasAccount() {
  try { localStorage.setItem(KEY, '1') } catch {}
}

export function hasAccountOnThisDevice(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}
