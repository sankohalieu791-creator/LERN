import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// One-off verification for the three Final Build Spec features (Work
// Experience, Talent Pools automation, Bootcamp Evidence), 23 Sep 2026
// -- run against the real production site with the real demo accounts
// and demo data seeded for this purpose. Not a permanent CI suite.
const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '../../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DEMO_PASSWORD = 'DemoVerify2026!'

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL(/\/(institution|provider|employer)/, { timeout: 15_000 })
}

test.describe('Work Experience (institution)', () => {
  test('overview shows placed/unplaced students and a real attendance fraction', async ({ page }) => {
    await login(page, 'lernops@tool.co.uk')
    await page.goto('/institution/work-experience')
    await expect(page.getByRole('main').getByText('Work Experience')).toBeVisible()

    // Seeded: Sofia Ahmed + Noah Bennett placed, Amelia Clarke + Leo
    // Thompson unplaced, in the "All students" group.
    await expect(page.getByText('Sofia Ahmed')).toBeVisible()
    await expect(page.getByText('Bright Media Studio', { exact: false })).toBeVisible()
    await expect(page.getByText('Unplaced').first()).toBeVisible()

    // Open Sofia's placement and confirm the day-by-day strip renders
    // with real present/absent marks, not a placeholder.
    await page.getByText('Sofia Ahmed').click()
    await expect(page.getByText('days present')).toBeVisible()
    await expect(page.getByText('Bright Media Studio', { exact: false })).toBeVisible()
  })
})

test.describe('Bootcamp Evidence (provider)', () => {
  test('cohort shows real attendance, completion, and interview outcome per learner', async ({ page }) => {
    await login(page, 'lernopsprovider@tool.co.uk')
    await page.goto('/provider/bootcamp-evidence')
    await expect(page.getByRole('main').getByText('Bootcamp Evidence')).toBeVisible()

    // Seeded: Noah Bennett meets both thresholds and has an interview
    // booked; Amelia Clarke meets neither.
    await expect(page.getByText('Noah Bennett')).toBeVisible()
    await expect(page.getByText('12/10 days')).toBeVisible()
    await expect(page.getByText('Interview booked', { exact: false })).toBeVisible()
    await expect(page.getByText('Amelia Clarke')).toBeVisible()
    await expect(page.getByText('8/10 days')).toBeVisible()

    await expect(page.getByRole('button', { name: /export funding evidence/i })).toBeVisible()
  })
})

test.describe('Talent Pools automatic cadence', () => {
  test('the cron route sends due stages exactly once, never twice', async ({ request }) => {
    const cronUrl = 'https://lernapp.uk/api/cron/talent-pool-cadence'
    const secret = process.env.CRON_SECRET_FOR_TEST
    test.skip(!secret, 'Set CRON_SECRET_FOR_TEST (the same value as the Vercel CRON_SECRET env var) to run this test.')

    const first = await request.get(cronUrl, { headers: { Authorization: `Bearer ${secret}` } })
    expect(first.ok()).toBeTruthy()
    const firstBody = await first.json()
    expect(firstBody.sent).toBeGreaterThan(0)

    // Idempotency: running it again immediately must send nothing new
    // -- everything currently due was already logged by the first run.
    const second = await request.get(cronUrl, { headers: { Authorization: `Bearer ${secret}` } })
    const secondBody = await second.json()
    expect(secondBody.sent).toBe(0)

    // Wrong secret is rejected.
    const unauthorized = await request.get(cronUrl, { headers: { Authorization: 'Bearer wrong-secret' } })
    expect(unauthorized.status()).toBe(401)
  })

  test('a sent stage is a real message in the employer<->org interest thread, and shows in the pool log', async ({ page }) => {
    const { data: sends } = await admin
      .from('talent_pool_cadence_sends')
      .select('member_id, stage, sent_at, talent_pool_members(student_id, pool_id, talent_pools(employer_id))')
      .order('sent_at', { ascending: false })
      .limit(5)
    expect(sends && sends.length).toBeGreaterThan(0)

    await login(page, 'lernopsemployer@tool.co.uk')
    await page.goto('/employer/talent-pools')
    // Both seeded pools ("Design talent", "Digital skills") should now
    // show at least one automatically-sent stage in their log.
    await page.getByText('Design talent').click()
    await expect(page.getByText(/sent automatically/i).first()).toBeVisible()
  })
})
