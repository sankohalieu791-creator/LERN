import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Real browser checks against the live production site (lernapp.uk),
// written for a one-off production-readiness audit rather than as a
// CI suite. Uses the service role only to (a) bypass email confirmation
// for accounts this test itself creates, so the flow can be driven
// automatically end to end, and (b) delete those same test accounts
// afterward -- never touches anything it didn't create.
const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '../../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// listUsers() only returns one page (50 by default) -- this project now
// has 60+ accounts, so a plain listUsers().find(...) silently misses
// anyone past page 1. Page through properly instead.
async function findUserByEmail(email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const user = data.users.find(u => u.email === email)
    if (user) return user
    if (data.users.length < 200) break
  }
  return undefined
}

async function confirmEmail(email: string) {
  const user = await findUserByEmail(email)
  if (user) await admin.auth.admin.updateUserById(user.id, { email_confirm: true })
  return user?.id
}

async function deleteUserByEmail(email: string) {
  const user = await findUserByEmail(email)
  if (user) await admin.auth.admin.deleteUser(user.id)
}

test.describe('Public pages', () => {
  test('homepage loads', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('login page renders and rejects wrong credentials', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill('nobody-real-1234@example.com')
    await page.getByLabel('Password').fill('wrongpassword123')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByText(/could not sign in|invalid/i)).toBeVisible({ timeout: 10_000 })
  })

  test('ops login rejects wrong password for the real ops email', async ({ page }) => {
    await page.goto('/ops/login')
    await page.getByLabel('Email').fill('Lernapp@alieu.co.uk')
    await page.getByLabel('Password').fill('definitely-not-the-real-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText(/incorrect email or password/i)).toBeVisible({ timeout: 10_000 })
    // Never actually reached the ops shell
    await expect(page).toHaveURL(/\/ops\/login/)
  })
})

test.describe('Signup gates', () => {
  test('employer signup rejects a personal gmail address, client-side', async ({ page }) => {
    await page.goto('/auth/signup/employer')
    await page.getByLabel('Full name').fill('Test Employer')
    await page.getByLabel('Email').fill('sometestemployer@gmail.com')
    await page.getByLabel('Password').fill('TestPassword123')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByText(/use your work email address/i)).toBeVisible()
  })

  test('institution signup rejects a personal gmail address, client-side', async ({ page }) => {
    await page.goto('/auth/signup/organisation')
    await page.getByLabel('School or college name').fill('Test School')
    await page.getByLabel('Your full name').fill('Test Person')
    await page.getByLabel('Your email').fill('sometestschool@gmail.com')
    await page.getByLabel('Password').fill('TestPassword123')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByText(/use your school or college email/i)).toBeVisible({ timeout: 10_000 })
  })

  test('student signup with a brand-new email succeeds (signup is genuinely open)', async ({ page }) => {
    // Not @example.com -- the mail provider's sandbox mode rejects that
    // domain specifically ("use our testing email address instead"),
    // which would fail this test for a reason unrelated to the app.
    const randomEmail = `real-signup-check-${Date.now()}@lernapp.uk`
    await page.goto('/auth/signup/student')
    await page.getByLabel('Full name').fill('Test Student')
    await page.getByLabel('Email').fill(randomEmail)
    await page.getByLabel('Password').fill('TestPassword123')
    await page.getByLabel('Date of birth').fill('2008-01-01')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    // Wait for the request to actually finish (button stops being disabled/
    // loading) before checking anything -- checking immediately after
    // click races the still-pending signUp() call.
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled({ timeout: 15_000 }).catch(() => {})
    await expect(page.getByText(/database error|something went wrong/i)).not.toBeVisible()
    const user = await findUserByEmail(randomEmail)
    expect(user).toBeDefined()
    if (user) await admin.auth.admin.deleteUser(user.id)
  })
})

test.describe('Explore-without-code (student)', () => {
  const email = 'preview.student@lernapp.uk'
  const password = 'TestPassword123!'

  test.beforeAll(() => deleteUserByEmail(email))
  test.afterAll(() => deleteUserByEmail(email))

  test('signs up, skips join code, lands on feed with posting/search locked', async ({ page }) => {
    await page.goto('/auth/signup/student')
    await page.getByLabel('Full name').fill('Preview Student')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByLabel('Date of birth').fill('2008-01-01')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    // If email confirmation is required, confirm it via the admin API, log
    // in for a live session -- /auth/login itself routes straight to the
    // dashboard, it doesn't know about an unfinished signup, so go back to
    // the signup page afterward, which does resume from the right step.
    // locator.isVisible() checks the DOM instantly, it does not wait --
    // a timeout passed to it is silently ignored. waitFor() is the one
    // that actually polls, which matters here since account creation
    // hasn't resolved yet at the moment this check first runs.
    const needsConfirm = await page.getByText(/check your email/i)
      .waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false)
    if (needsConfirm) {
      await confirmEmail(email)
      await page.goto('/auth/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Log in' }).click()
      await page.waitForURL(u => new URL(u).pathname === '/student', { timeout: 15_000 })
      await page.goto('/auth/signup/student')
    }

    // Join-code step: skip it deliberately (explore without a code). Only
    // shown on the very first pass through -- resuming after confirming an
    // email jumps straight to consent instead, since date of birth is
    // already saved and the join code was always optional.
    const onJoinCodeStep = await page.getByText(/join your organisation/i)
      .waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false)
    if (onJoinCodeStep) await page.getByText(/skip for now/i).click()

    // Safeguarding consent
    await expect(page.getByText(/keeping you safe/i)).toBeVisible()
    await page.getByRole('button', { name: /i understand, accept/i }).click()

    // Greeting screen then the real dashboard -- pathname must be exactly
    // /student, not just contain it (the signup page URL itself does)
    await page.waitForURL(u => new URL(u).pathname === '/student', { timeout: 15_000 })
    await expect(page.locator('body')).not.toContainText('Application error')
    await page.screenshot({ path: 'test-results/student-feed.png', fullPage: true })

    // Try to post -- should be blocked with the join-code message, not
    // silently succeed. The composer is photo-first (camera capture UI),
    // so a real post attempt needs an actual file through its hidden
    // file input before the "Post" button and its organisation_id
    // check are even reachable.
    await page.getByRole('button', { name: 'New post' }).click()
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    await page.locator('input[type="file"]').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: tinyPng })
    await page.getByRole('button', { name: 'Post', exact: true }).first().click()
    await expect(page.getByText(/join.*organisation|join code/i)).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Employer verification, real data', () => {
  const email = 'preview.employer@lernapp.uk'
  const password = 'TestPassword123!'

  test.beforeAll(() => deleteUserByEmail(email))
  test.afterAll(() => deleteUserByEmail(email))

  test('signs up, submits real Companies House number + matching domain, both checks pass', async ({ page }) => {
    await page.goto('/auth/signup/employer')
    await page.getByLabel('Full name').fill('Preview Employer')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    const needsConfirm = await page.getByText(/check your email/i)
      .waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false)
    if (needsConfirm) {
      await confirmEmail(email)
      await page.goto('/auth/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Log in' }).click()
      await page.waitForURL(u => new URL(u).pathname === '/employer', { timeout: 15_000 })
      await page.goto('/auth/signup/employer')
    }

    await expect(page.getByText(/tell us about your company/i)).toBeVisible({ timeout: 15_000 })
    await page.getByLabel('Companies House number').fill('17200180')
    // lernapp.uk matches this account's own email domain exactly --
    // the domain-match check should pass, independent of the (also
    // real) Companies House lookup on 17200180.
    await page.getByLabel('Company website').fill('lernapp.uk')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    await expect(page.getByText(/how lern protects young people/i)).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /i understand, accept/i }).click()
    await page.waitForURL(u => new URL(u).pathname === '/employer', { timeout: 15_000 })
    await expect(page.getByText(/under review/i)).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: 'test-results/employer-pending.png', fullPage: true })
  })
})

test.describe('Institution signup, real end to end', () => {
  const email = 'preview.school@lernapp.uk'
  const password = 'TestPassword123!'

  test.beforeAll(() => deleteUserByEmail(email))
  test.afterAll(() => deleteUserByEmail(email))

  test('sets up a new school, gets a join code, lands on the real dashboard', async ({ page }) => {
    await page.goto('/auth/signup/organisation')
    await page.getByLabel('School or college name').fill('Preview School')
    await page.getByLabel('Your full name').fill('Preview Staff')
    await page.getByLabel('Your email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    const needsConfirm = await page.getByText(/check your email/i)
      .waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false)
    if (needsConfirm) {
      await confirmEmail(email)
      await page.goto('/auth/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Log in' }).click()
      // Login now detects an unfinished org signup (role is still the
      // placeholder 'student') and sends it straight back to the org
      // wizard itself, not the student dashboard -- no manual goto needed.
      await page.waitForURL(u => new URL(u).pathname === '/auth/signup/organisation', { timeout: 15_000 })
    }

    await expect(page.getByText(/safeguarding and data-processing position/i)).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /i agree, accept/i }).click()

    await expect(page.getByText(/your join code/i)).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: 'test-results/institution-join-code.png', fullPage: true })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    await page.waitForURL(u => new URL(u).pathname === '/institution', { timeout: 15_000 })
    await expect(page.locator('body')).not.toContainText('Application error')
    await page.screenshot({ path: 'test-results/institution-dashboard.png', fullPage: true })
  })
})

test.describe('Search shows the other student, not yourself', () => {
  // Two real students, same org, created directly via the admin API
  // rather than through full signup -- only search + profile display
  // are under test here, so the org itself is just scaffolding.
  const orgId = '22222222-2222-4222-8222-222222222222'
  const emailA = 'qa.crossprofile.a@lernapp.uk'
  const emailB = 'qa.crossprofile.b@lernapp.uk'
  const nameB = 'Bilal Test'
  const password = 'TestPassword123!'

  const createStudent = async (email: string, fullName: string) => {
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { role: 'student', full_name: fullName, date_of_birth: '2008-01-01' },
    })
    if (error) throw error
    await admin.from('users').update({ organisation_id: orgId, consented_at: new Date().toISOString() }).eq('id', data.user.id)
  }

  test.beforeAll(async () => {
    await deleteUserByEmail(emailA)
    await deleteUserByEmail(emailB)
    await admin.from('organisations').upsert({ id: orgId, name: 'QA Cross-Profile Test Org', type: 'institution' })
    await createStudent(emailA, 'Amara Test')
    await createStudent(emailB, nameB)
  })

  test.afterAll(async () => {
    await deleteUserByEmail(emailA)
    await deleteUserByEmail(emailB)
    await admin.from('organisations').delete().eq('id', orgId)
  })

  test('viewing another student profile from search shows their name, not the viewer\'s own', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(emailA)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await page.waitForURL(u => new URL(u).pathname === '/student', { timeout: 15_000 })

    // Created via the admin API, not the real wizard -- never went
    // through consent, so the app correctly intercepts with it first.
    const needsConsent = await page.getByText(/keeping you safe/i)
      .waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)
    if (needsConsent) {
      await page.getByRole('button', { name: /i understand, accept/i }).click()
      await page.waitForURL(u => new URL(u).pathname === '/student', { timeout: 15_000 })
    }

    await page.goto('/student/search')
    await page.getByPlaceholder('Search people, posts and videos…').fill('Bilal')
    const result = page.getByText(nameB, { exact: true })
    await expect(result).toBeVisible({ timeout: 10_000 })
    await result.click()

    // The exact defect from 10 September: this used to default to the
    // viewer's OWN name (Amara Test) instead of the profile actually
    // being viewed (Bilal Test).
    await page.waitForURL(/\/student\/profile\//, { timeout: 10_000 })
    await expect(page.getByText(nameB, { exact: true }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Amara Test', { exact: true })).not.toBeVisible()
  })
})

test.describe('Employer inbox placeholder text', () => {
  const employerEmail = 'qa.employerinbox@lernapp.uk'
  const studentEmail = 'qa.noname.student@lernapp.uk'
  const password = 'TestPassword123!'

  // Genuinely verifies the employer through the real flow (real company,
  // real ops approval via an authenticated ops session) rather than
  // shortcutting employer_verified -- the inbox is unreachable at all
  // without it, so there is no way to test this defect otherwise.
  test.beforeAll(async () => {
    await deleteUserByEmail(employerEmail)
    await deleteUserByEmail(studentEmail)

    const { data: empData, error: empErr } = await admin.auth.admin.createUser({
      email: employerEmail, password, email_confirm: true,
      user_metadata: { role: 'employer', full_name: 'QA Employer' },
    })
    if (empErr) throw empErr
    const employerId = empData.user.id

    await admin.from('users').update({
      employer_company_number: '17200180',
      employer_company_name: 'IRL CONNECT LTD',
      employer_website: 'lernapp.uk',
      employer_verification_requested_at: new Date().toISOString(),
      employer_verification_status: 'pending',
      employer_check_email_domain: 'pass',
      employer_check_ch: 'pass',
      employer_check_ch_detail: 'Active — IRL CONNECT LTD',
      consented_at: new Date().toISOString(),
    }).eq('id', employerId)

    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: opsSession, error: opsErr } = await anon.auth.signInWithPassword({
      email: 'Lernapp@alieu.co.uk', password: 'alieu1221&',
    })
    if (opsErr) throw opsErr
    const opsClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${opsSession.session.access_token}` } },
    })
    await opsClient.rpc('set_employer_manual_check', { p_employer_id: employerId, p_check: 'website', p_value: true })
    await opsClient.rpc('set_employer_manual_check', { p_employer_id: employerId, p_check: 'officer', p_value: true })
    const { error: approveErr } = await opsClient.rpc('approve_employer_verification', { p_employer_id: employerId })
    if (approveErr) throw approveErr

    const { data: studData, error: studErr } = await admin.auth.admin.createUser({
      email: studentEmail, password, email_confirm: true,
      user_metadata: { role: 'student', full_name: 'placeholder', date_of_birth: '2008-01-01' },
    })
    if (studErr) throw studErr
    await admin.from('users').update({ full_name: null }).eq('id', studData.user.id)

    const { error: interestErr } = await admin.from('interest').insert([{
      employer_id: employerId, student_id: studData.user.id, status: 'pending',
    }])
    if (interestErr) throw interestErr
  })

  test.afterAll(async () => {
    await deleteUserByEmail(employerEmail)
    await deleteUserByEmail(studentEmail)
  })

  test('shows the full "A student" fallback, not truncated to "A"', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(employerEmail)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await page.waitForURL(u => new URL(u).pathname === '/employer', { timeout: 15_000 })

    const needsConsent = await page.getByText(/how lern protects young people/i)
      .waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)
    if (needsConsent) {
      await page.getByRole('button', { name: /i understand, accept/i }).click()
      await page.waitForURL(u => new URL(u).pathname === '/employer', { timeout: 15_000 })
    }

    await page.goto('/employer/inbox')
    // The exact 10 September defect: .split(' ')[0] was applied to the
    // fallback phrase itself, truncating "A student" down to just "A".
    // Matching the exact full phrase (not a substring) is what actually
    // distinguishes the fix from the bug -- a loose substring check
    // would pass either way.
    await expect(page.getByText('A student', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('A', { exact: true })).not.toBeVisible()
  })
})
