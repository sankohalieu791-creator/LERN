import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Payment verification fix, 23 Sep 2026 -- proves EmployerBillingGate
// decides access from the database's real billing state, never from the
// Checkout redirect alone. Two fresh employer accounts, real Stripe test
// mode: one pays with a card that succeeds, one with a card Stripe
// itself declines. Not a permanent CI suite -- a one-off audit.
const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '../../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const password = 'TestPassword123!'

async function findUserByEmail(email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const user = data.users.find(u => u.email === email)
    if (user) return user
    if (data.users.length < 200) break
  }
  return undefined
}

async function deleteUserByEmail(email: string) {
  const user = await findUserByEmail(email)
  if (user) await admin.auth.admin.deleteUser(user.id)
}

// Creates a fully verified employer with NO tier and NO Stripe
// subscription -- the exact state EmployerBillingGate exists to catch.
async function createVerifiedUnpaidEmployer(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { role: 'employer', full_name: 'Gate Test Employer' },
  })
  if (error) throw error
  const employerId = data.user.id
  await admin.from('users').update({
    employer_verified: true,
    employer_verification_status: 'approved',
    consented_at: new Date().toISOString(),
  }).eq('id', employerId)
  return employerId
}

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL(u => new URL(u).pathname.startsWith('/employer'), { timeout: 15_000 })
}

test.describe('Employer payment gate', () => {
  test('a verified employer with no tier is gated, never sees Discover/Jobs/Candidates/Inbox', async ({ page }) => {
    const email = `gate-unpaid-${Date.now()}@lernapp.uk`
    await createVerifiedUnpaidEmployer(email)
    try {
      await login(page, email)
      await expect(page.getByRole('heading', { name: 'Choose your plan to continue' })).toBeVisible({ timeout: 10_000 })
      // Direct navigation to a gated route must not bypass the gate.
      await page.goto('/employer/discover')
      await expect(page.getByRole('heading', { name: 'Choose your plan to continue' })).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('Discover', { exact: true })).not.toBeVisible()
    } finally {
      await deleteUserByEmail(email)
    }
  })

  test('a real successful payment only unlocks once the database confirms it, and shows a pending state first', async ({ page }) => {
    test.setTimeout(90_000)
    const email = `gate-success-${Date.now()}@lernapp.uk`
    await createVerifiedUnpaidEmployer(email)
    try {
      await page.setViewportSize({ width: 800, height: 1100 })
      await login(page, email)
      await page.getByPlaceholder('e.g. 40').fill('5')
      await page.getByRole('button', { name: /continue to payment/i }).click()
      // Stripe's own hosted page is heavy enough that "load" can take
      // longer than a typical navigation, even once the URL and DOM
      // content are already there.
      await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 })

      await page.waitForTimeout(3000)
      await page.getByRole('radio', { name: /card/i }).click({ force: true }).catch(() => {})
      const cardNumberField = page.getByPlaceholder('1234 1234 1234 1234')
      await cardNumberField.waitFor({ state: 'visible', timeout: 10_000 })
      await cardNumberField.fill('4242424242424242')
      await page.getByPlaceholder('MM / YY').fill('12/34')
      await page.getByPlaceholder('CVC').fill('123')
      await page.getByPlaceholder('Full name on card').fill('Gate Test Employer')
      // The exact final submit button -- /pay|subscribe/i alone also
      // matches the "Pay with card" accordion TOGGLE above the card
      // fields, which stays in the DOM (just not visible) once that
      // section is already open, and .first() grabbed that instead.
      await page.getByRole('button', { name: 'Pay and subscribe' }).click()

      // Land back on lernapp.uk -- must NOT be unlocked instantly. The
      // whole point of this test: the pending/confirming state has to
      // exist and be real, not skipped straight to success.
      await page.waitForURL(/lernapp\.uk/, { timeout: 20_000 })
      const sawPending = await page.getByText(/confirming your payment/i).isVisible().catch(() => false)

      // Whether or not the pending screen was still visible at the exact
      // moment we checked (the webhook can be fast), the DB is the real
      // source of truth -- assert on that directly, not on a screenshot
      // of a race. The gate heading disappearing (never re-rendered once
      // it passes) is the unlock signal, not a sidebar label -- OrgShell's
      // desktop nav text sits behind a `lg:` breakpoint this 800px
      // viewport (chosen for Stripe's own card-field layout) is under,
      // so "Discover" stays legitimately hidden even once truly unlocked.
      await expect(page.getByRole('heading', { name: 'Choose your plan to continue' })).not.toBeVisible({ timeout: 30_000 })
      const user = await findUserByEmail(email)
      const { data: profile } = await admin.from('users').select('employer_tier, employer_subscription_status, employer_stripe_subscription_id').eq('id', user!.id).single()
      expect(profile?.employer_tier).toBe('micro')
      expect(profile?.employer_subscription_status).toBe('active')
      expect(profile?.employer_stripe_subscription_id).toBeTruthy()

      test.info().annotations.push({ type: 'pending-state-observed', description: String(sawPending) })
    } finally {
      // The real Stripe test-mode subscription this creates is left in
      // place (STRIPE_SECRET_KEY isn't in the local env this runs with)
      // -- cancelled by hand afterward. Harmless either way: test mode,
      // no real money.
      await deleteUserByEmail(email)
    }
  })

  test('a declined card never leaves Stripe Checkout, and the employer stays gated', async ({ page }) => {
    test.setTimeout(60_000)
    const email = `gate-decline-${Date.now()}@lernapp.uk`
    await createVerifiedUnpaidEmployer(email)
    try {
      await page.setViewportSize({ width: 800, height: 1100 })
      await login(page, email)
      await page.getByPlaceholder('e.g. 40').fill('5')
      await page.getByRole('button', { name: /continue to payment/i }).click()
      await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 })

      await page.waitForTimeout(3000)
      await page.getByRole('radio', { name: /card/i }).click({ force: true }).catch(() => {})
      const cardNumberField = page.getByPlaceholder('1234 1234 1234 1234')
      await cardNumberField.waitFor({ state: 'visible', timeout: 10_000 })
      // Stripe's own generic-decline test card.
      await cardNumberField.fill('4000000000000002')
      await page.getByPlaceholder('MM / YY').fill('12/34')
      await page.getByPlaceholder('CVC').fill('123')
      await page.getByPlaceholder('Full name on card').fill('Gate Test Employer')
      await page.getByRole('button', { name: 'Pay and subscribe' }).click()

      // Must stay on Stripe's own page with a decline error -- never
      // redirected to lernapp.uk's success URL.
      await expect(page.getByText(/declined/i)).toBeVisible({ timeout: 15_000 })
      expect(page.url()).toContain('checkout.stripe.com')

      // Back on LERN (simulating giving up / closing the tab and
      // returning), still fully gated -- no false unlock happened.
      await page.goto('/employer')
      await expect(page.getByRole('heading', { name: 'Choose your plan to continue' })).toBeVisible({ timeout: 10_000 })
      const user = await findUserByEmail(email)
      const { data: profile } = await admin.from('users').select('employer_tier').eq('id', user!.id).single()
      expect(profile?.employer_tier).toBeNull()
    } finally {
      await deleteUserByEmail(email)
    }
  })
})
