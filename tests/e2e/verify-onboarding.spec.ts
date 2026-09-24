import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Onboarding tour, 24 Sep 2026 -- proves the real "welcome, take a tour
// or skip" flow against production for a genuinely fresh account (never
// seen onboarding before), not just the demo accounts which may already
// have been through it during earlier verification.
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

async function createFreshEmployer(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { role: 'employer', full_name: 'Onboarding Test Employer' },
  })
  if (error) throw error
  await admin.from('users').update({
    employer_verified: true, employer_verification_status: 'approved', consented_at: new Date().toISOString(),
    employer_tier: 'micro', employer_subscription_status: 'active',
  }).eq('id', data.user.id)
  return data.user.id
}

test.describe('Onboarding tour', () => {
  test('a fresh employer sees the welcome screen, can step through the tour, and it never shows again', async ({ page }) => {
    const email = `onboard-${Date.now()}@lernapp.uk`
    await createFreshEmployer(email)
    try {
      await page.goto('/auth/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Log in' }).click()
      await page.waitForURL(u => new URL(u).pathname.startsWith('/employer'), { timeout: 15_000 })

      await expect(page.getByRole('heading', { name: 'Welcome to LERN' })).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: 'Take the tour' }).click()
      await expect(page.getByText('Discover', { exact: true }).first()).toBeVisible()

      // Step through every step to "Get started".
      let clicks = 0
      while (clicks < 10) {
        const getStarted = page.getByRole('button', { name: 'Get started' })
        if (await getStarted.isVisible().catch(() => false)) { await getStarted.click(); break }
        await page.getByRole('button', { name: 'Next' }).click()
        clicks++
      }

      // Tour is gone, real dashboard underneath.
      await expect(page.getByRole('heading', { name: 'Welcome to LERN' })).not.toBeVisible()
      await expect(page.getByText('Talent pools', { exact: true }).first()).toBeVisible()

      // A fresh page load must not show it again.
      await page.reload()
      await page.waitForTimeout(1500)
      await expect(page.getByRole('heading', { name: 'Welcome to LERN' })).not.toBeVisible()

      const user = await findUserByEmail(email)
      const { data: profile } = await admin.from('users').select('onboarding_completed_at').eq('id', user!.id).single()
      expect(profile?.onboarding_completed_at).toBeTruthy()
    } finally {
      await deleteUserByEmail(email)
    }
  })

  test('Replay tutorial in Settings reopens the tour on demand', async ({ page }) => {
    const email = `onboard-replay-${Date.now()}@lernapp.uk`
    const userId = await createFreshEmployer(email)
    // Mark it already seen, matching a real account past its first login.
    await admin.from('users').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', userId)
    try {
      await page.goto('/auth/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Log in' }).click()
      await page.waitForURL(u => new URL(u).pathname.startsWith('/employer'), { timeout: 15_000 })

      // Already seen -- no automatic welcome screen this time.
      await expect(page.getByRole('heading', { name: 'Welcome to LERN' })).not.toBeVisible({ timeout: 3000 })

      await page.goto('/employer/settings')
      await page.getByText('Replay tutorial').click()
      await expect(page.getByRole('heading', { name: 'Welcome to LERN' })).toBeVisible({ timeout: 5000 })
    } finally {
      await deleteUserByEmail(email)
    }
  })
})
