'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  updateUserProfile, changePassword, setThemePreference, setNotificationPrefs,
  exportMyData, deleteMyAccount, submitReport, signOut,
  getOrgStaff, updateOrganisationProfile, supabase,
  requestEmailChange, sendPasswordResetEmail, signOutEverywhere,
  getBlockedUsers, unblockUser, setCookieConsent, uploadOrgLogo, getAvatarUrl,
  uploadAvatar, removeAvatar,
  getLernDeliveryAdults, getLernAdultFrequency, addLernDeliveryAdult, updateLernDeliveryAdult,
  getLernSessionLog, recordLernSessionCancellation,
} from '@/lib/supabase'
import type { LernDeliveryAdult, LernAdultFrequency, LernSessionLogEntry } from '@/lib/types'
import { TextField, PrimaryButton, SecondaryButton, ErrorBanner } from '@/components/v2/Field'
import {
  Sun, Moon, Monitor, ShieldCheck, Users2, Ticket,
  Mail, UserX, ChevronRight, ChevronLeft, Camera, BadgeCheck, LogOut,
  Lock, AlertTriangle, Download, Plus, Ban,
} from 'lucide-react'
import JoinCodesPanel from '@/components/v2/JoinCodesPanel'

// Admin-only, gated purely by email (not role) -- "LERN adult" is a
// concept that has nothing to do with student/institution_staff/
// provider_staff/employer, and this must stay invisible to every one
// of those regardless of who's signed in as what. The RLS policies on
// both tables are the real boundary; this only decides whether to
// render the entry point at all.
const LERN_ADMIN_EMAIL = 'alieu@joinirl.co.uk'

// Rebuilt to the same grouped-row-list structure as the student app's
// own Settings (Group/Row/ToggleRow, one flowing screen, sub-screens
// for anything with its own form) instead of this shell's previous
// stack of bordered Cards -- same request as "bring org up to the same
// depth as student's settings," applied to the shape of the page
// itself, not just what's on it. Colours stay this shell's own
// (--paper/--ink, light-first with dark support) rather than student's
// --app-* dark-only palette -- the pattern is shared, the theme isn't.
const NOTIFICATION_LABELS: Record<string, string> = {
  work_submitted: 'Work submitted for review',
  work_verified: 'Work verified',
  employer_interest: 'Employer interest',
  reports: 'New reports',
}

type Screen = null | 'email' | 'password' | 'photo' | 'rename' | 'organisation' | 'blocked' | 'report' | 'delete' | 'consent' | 'admin-safeguarding'

export default function SettingsPanel() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>(null)
  const [org, setOrg] = useState<any>(null)
  const [busyField, setBusyField] = useState<string | null>(null)
  const isOrgAdmin = user?.role === 'institution_staff' || user?.role === 'provider_staff'

  useEffect(() => {
    if (user?.organisation_id) {
      supabase.from('organisations').select('*').eq('id', user.organisation_id).single().then(({ data }) => setOrg(data))
    }
  }, [user?.organisation_id])

  if (!user) return null

  const prefs = user.notification_prefs || { work_submitted: true, work_verified: true, employer_interest: true, reports: true }
  const saveNotif = async (key: string, value?: boolean) => {
    setBusyField(key)
    await setNotificationPrefs(user.id, { ...prefs, [key]: value ?? !prefs[key] })
    await refreshUser()
    setBusyField(null)
  }

  const saveTheme = async (theme: 'light' | 'dark' | 'system') => {
    setBusyField('theme')
    await setThemePreference(user.id, theme)
    await refreshUser()
    setBusyField(null)
  }

  const requestReset = async () => {
    setBusyField('reset')
    const { error } = await sendPasswordResetEmail(user.email)
    setBusyField(null)
    // Was unconditional before -- a failed send (rate limit, bad email
    // on the account, network) still told the user it had gone out.
    alert(error ? `Couldn't send the reset link — ${error.message}` : `A password reset link has been sent to ${user.email}.`)
  }

  const toggleTwoStep = async () => {
    setBusyField('two_step')
    await updateUserProfile(user.id, { two_step_enabled: !user.two_step_enabled })
    await refreshUser()
    setBusyField(null)
  }

  const requestSignOutEverywhere = async () => {
    if (!confirm('Sign out of every device you’re signed in on?')) return
    const { error } = await signOutEverywhere()
    // A failed global sign-out still redirected this device to login as
    // if it had worked, silently leaving every OTHER device signed in --
    // the one thing this button exists to guarantee.
    if (error) { alert(`Couldn't sign out everywhere — ${error.message}`); return }
    router.replace('/auth/login')
  }

  const toggleAnalytics = async () => {
    setBusyField('cookies')
    await setCookieConsent(user.id, !(user.cookie_consent?.analytics ?? false))
    await refreshUser()
    setBusyField(null)
  }

  // ── Sub-screens ──
  if (screen === 'email') return <ChangeEmailScreen currentEmail={user.email} onBack={() => setScreen(null)} />
  if (screen === 'password') return <ChangePasswordScreen onBack={() => setScreen(null)} />
  if (screen === 'photo') return <PhotoScreen onBack={() => setScreen(null)} />
  if (screen === 'rename') return <RenameScreen onBack={() => setScreen(null)} />
  if (screen === 'organisation') return <OrganisationScreen org={org} onBack={() => setScreen(null)} onChanged={() => { setOrg(null); if (user.organisation_id) supabase.from('organisations').select('*').eq('id', user.organisation_id).single().then(({ data }) => setOrg(data)) }} />
  if (screen === 'blocked') return <BlockedAccountsScreen userId={user.id} onBack={() => setScreen(null)} />
  if (screen === 'report') return <ReportScreen userId={user.id} organisationId={user.organisation_id || null} onBack={() => setScreen(null)} />
  if (screen === 'delete') return <DeleteAccountScreen email={user.email} onBack={() => setScreen(null)} />
  if (screen === 'consent') return <ConsentScreen consentedAt={user.consented_at} onBack={() => setScreen(null)} onDelete={() => setScreen('delete')} />
  if (screen === 'admin-safeguarding') return <AdminSafeguardingScreen onBack={() => setScreen(null)} />

  const logoUrl = org?.logo_path ? getAvatarUrl(org.logo_path) : null
  const avatarUrl = user.avatar_path ? getAvatarUrl(user.avatar_path) : null

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <p className="text-[22px] font-bold text-ink mb-5">Settings</p>

      {/* ── Organisation, first -- this identity (name, logo, verified
          tick) is what actually shows up on course/brief/workshop
          cards, ahead of the staff member's own personal account. ── */}
      {isOrgAdmin && (
        <Group title="Organisation">
          <Row
            label={org?.name || 'Your organisation'}
            onClick={() => setScreen('organisation')}
            right={
              <span className="flex items-center gap-2">
                {org?.verified && <BadgeCheck className="w-4 h-4 flex-shrink-0" style={{ color: '#4a9de0' }} />}
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <span className="w-8 h-8 rounded-lg bg-accent-bg text-brand font-bold text-[12px] flex items-center justify-center">{org?.name?.[0]?.toUpperCase() || 'O'}</span>
                )}
              </span>
            }
          />
          <Row label="Join codes and staff" onClick={() => setScreen('organisation')} />
        </Group>
      )}

      {/* ── Account ── */}
      <Group title="Account">
        <Row
          label="Profile photo" onClick={() => setScreen('photo')}
          right={avatarUrl ? <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" /> : <span className="w-8 h-8 rounded-full bg-accent-bg text-brand font-bold text-[12px] flex items-center justify-center">{user.full_name?.[0]?.toUpperCase() || 'U'}</span>}
        />
        <Row label="Full name" value={user.full_name} onClick={() => setScreen('rename')} />
        <Row label="Email" value={user.email} onClick={() => setScreen('email')} />
        <Row label="Change password" onClick={() => setScreen('password')} />
        {user.role === 'employer' && (
          <Row
            label="Employer status" noChevron
            value={user.employer_verified ? undefined : 'Not yet verified'}
            right={user.employer_verified ? <span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: '#4a9de0' }}><BadgeCheck className="w-3.5 h-3.5" /> Verified</span> : undefined}
          />
        )}
      </Group>

      {/* ── Security and sign-in ── */}
      <Group title="Security and sign-in">
        <Row label="Reset password by email" onClick={requestReset} busy={busyField === 'reset'} />
        <ToggleRow label="Two-step verification" value={!!user.two_step_enabled} busy={busyField === 'two_step'} onToggle={toggleTwoStep} />
        <Row label="Sign out of all devices" onClick={requestSignOutEverywhere} danger />
        <Row label="Blocked accounts" onClick={() => setScreen('blocked')} />
      </Group>

      {/* ── Notifications ── */}
      <Group title="Notifications">
        <ToggleRow label="Push notifications" value={prefs.push_enabled !== false} busy={busyField === 'push_enabled'} onToggle={v => saveNotif('push_enabled', v)} />
        <ToggleRow label="Email notifications" value={prefs.email_enabled !== false} busy={busyField === 'email_enabled'} onToggle={v => saveNotif('email_enabled', v)} />
      </Group>
      <Group>
        {Object.entries(NOTIFICATION_LABELS).map(([key, label]) => (
          <ToggleRow key={key} label={label} value={prefs[key] !== false} busy={busyField === key} onToggle={() => saveNotif(key)} />
        ))}
      </Group>

      {/* ── Data and privacy ── */}
      <Group title="Data and privacy">
        <Row label="Download my data" onClick={async () => {
          const data = await exportMyData(user.id)
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = `lern-my-data-${new Date().toISOString().split('T')[0]}.json`; a.click()
          URL.revokeObjectURL(url)
        }} />
        <Row label="Consent" value="View" onClick={() => setScreen('consent')} />
        <ToggleRow label="Analytics cookies" hint="Essential cookies are always on" value={!!user.cookie_consent?.analytics} busy={busyField === 'cookies'} onToggle={toggleAnalytics} />
        <Row label="Delete my account and data" danger onClick={() => setScreen('delete')} />
      </Group>

      {/* ── Raise a concern ── */}
      <Group title="Raise a concern">
        <Row label="Report a problem or something that worries you" onClick={() => setScreen('report')} />
      </Group>

      {/* ── Appearance ── */}
      <Group title="Appearance">
        <div className="px-4 py-3.5">
          <div className="flex gap-2">
            {([['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]] as const).map(([key, label, Icon]) => (
              <button
                key={key} onClick={() => saveTheme(key)} disabled={busyField === 'theme'}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold transition ${
                  (user.theme_preference || 'system') === key ? 'bg-brand text-white' : 'bg-surface-subtle border border-edge text-ink-secondary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </Group>

      {/* ── Admin -- LERN's own adults delivering live sessions, never
          visible to institutions/students/employers. RLS is the real
          gate; this is only whether the entry point renders at all. ── */}
      {user.email?.toLowerCase() === LERN_ADMIN_EMAIL && (
        <Group title="Admin">
          <Row label="Session delivery & safeguarding" onClick={() => setScreen('admin-safeguarding')} />
        </Group>
      )}

      {/* ── About and legal ── */}
      <Group title="About and legal">
        <LinkRow label="Data Protection" href="/legal/privacy" />
        <LinkRow label="Cookie Policy" href="/legal/cookies" />
        <LinkRow label="Terms of Service" href="/legal/terms" />
        <LinkRow label="Public safeguarding summary" href="/legal/safeguarding" />
        <Row label="App version" value="1.0" noChevron />
        <a href="mailto:support@lernapp.uk" className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-muted transition">
          <span className="text-[14px] text-ink">Contact and support</span>
          <span className="flex items-center gap-1 text-[13px] text-ink-secondary"><Mail className="w-3.5 h-3.5" /> support@lernapp.uk</span>
        </a>
      </Group>

      <button
        onClick={async () => { await signOut(); router.replace('/auth/login') }}
        className="flex items-center justify-center gap-2 w-full text-[14px] font-semibold text-danger-text py-3.5 mt-2"
      >
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </div>
  )
}

// ── Shared row/group primitives -- org's own tokens (bg-surface/
// text-ink/border-edge), same structural pattern as the student app's
// Group/Row/ToggleRow. ──────────────────────────────────────────────
function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      {title && <p className="text-[13px] font-semibold text-ink-secondary mb-2 px-1">{title}</p>}
      <div className="bg-surface border border-edge rounded-2xl divide-y divide-edge-subtle overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, onClick, right, noChevron, noChevronValue, danger, busy }: {
  label: string; value?: string; onClick?: () => void; right?: React.ReactNode
  noChevron?: boolean; noChevronValue?: boolean; danger?: boolean; busy?: boolean
}) {
  const content = (
    <>
      <span className={`text-[14px] ${danger ? 'text-danger-text' : 'text-ink'}`}>{busy ? 'Working…' : label}</span>
      <span className="flex items-center gap-2 flex-shrink-0">
        {value && <span className="text-[13px] text-ink-secondary truncate max-w-[160px]">{value}</span>}
        {right}
        {onClick && !noChevron && !noChevronValue && <ChevronRight className="w-4 h-4 text-ink-tertiary" />}
      </span>
    </>
  )
  if (!onClick) return <div className="flex items-center justify-between px-4 py-3.5">{content}</div>
  return (
    <button onClick={onClick} disabled={busy} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-muted transition text-left disabled:opacity-60">
      {content}
    </button>
  )
}

function ToggleRow({ label, hint, value, onToggle, busy }: { label: string; hint?: string; value: boolean; onToggle: (v: boolean) => void; busy?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 gap-3">
      <div className="min-w-0">
        <p className="text-[14px] text-ink">{label}</p>
        {hint && <p className="text-[12px] text-ink-tertiary mt-0.5">{hint}</p>}
      </div>
      <button
        onClick={() => onToggle(!value)} disabled={busy}
        className={`w-11 h-6 rounded-full transition relative flex-shrink-0 disabled:opacity-50 border ${value ? 'bg-brand border-brand' : 'bg-surface-muted border-edge'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${value ? 'left-[21px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

function LinkRow({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-muted transition">
      <span className="text-[14px] text-ink">{label}</span>
      <ChevronRight className="w-4 h-4 text-ink-tertiary" />
    </Link>
  )
}

// ── Sub-screens ─────────────────────────────────────────────────
function ScreenShell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="max-w-lg mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-ink-secondary hover:text-ink transition mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to Settings
      </button>
      <div className="bg-surface border border-edge rounded-2xl p-6">
        <p className="font-bold text-ink text-[16px] mb-4">{title}</p>
        {children}
      </div>
    </div>
  )
}

function PhotoScreen({ onBack }: { onBack: () => void }) {
  const { user, refreshUser } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)
  const avatarUrl = user?.avatar_path ? getAvatarUrl(user.avatar_path) : null

  const choose = async (file: File | null) => {
    if (!file || !user) return
    setUploading(true); setError('')
    const { error: err } = await uploadAvatar(user.id, file)
    setUploading(false)
    if (err) return setError(err.message || 'Photo upload failed.')
    await refreshUser()
  }
  const remove = async () => {
    if (!user) return
    setUploading(true); setError('')
    const { error: err } = await removeAvatar(user.id, user.avatar_path)
    setUploading(false)
    if (err) return setError(err.message)
    await refreshUser()
  }

  return (
    <ScreenShell title="Profile photo" onBack={onBack}>
      <ErrorBanner message={error} />
      <p className="text-[13px] text-ink-secondary mb-4">
        {user?.role === 'employer' ? 'Shown on the jobs and roles you post.' : 'Shown next to your name across LERN.'}
      </p>
      <div className="flex items-center gap-3.5">
        <button onClick={() => photoRef.current?.click()} disabled={uploading} className="relative flex-shrink-0 disabled:opacity-60" aria-label="Change profile picture">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-accent-bg text-brand font-bold text-[18px] flex items-center justify-center">{user?.full_name?.[0]?.toUpperCase() || 'U'}</div>
          )}
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand flex items-center justify-center border-2 border-surface">
            <Camera className="w-3 h-3 text-white" />
          </span>
        </button>
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => choose(e.target.files?.[0] || null)} />
        <div>
          <p className="text-[13px] font-semibold text-ink">{uploading ? 'Uploading…' : 'Change photo'}</p>
          {user?.avatar_path && <button onClick={remove} disabled={uploading} className="text-[11.5px] font-semibold text-ink-secondary disabled:opacity-40 mt-0.5">Remove</button>}
        </div>
      </div>
    </ScreenShell>
  )
}

function RenameScreen({ onBack }: { onBack: () => void }) {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!user || !name.trim()) return
    setSaving(true); setError('')
    const { error: err } = await updateUserProfile(user.id, { full_name: name.trim() })
    setSaving(false)
    if (err) return setError(err.message)
    await refreshUser()
    onBack()
  }

  return (
    <ScreenShell title="Full name" onBack={onBack}>
      <ErrorBanner message={error} />
      <TextField label="Full name" value={name} onChange={setName} placeholder="Your name" />
      <PrimaryButton onClick={save} loading={saving} disabled={!name.trim()}>Save</PrimaryButton>
    </ScreenShell>
  )
}

function ChangePasswordScreen({ onBack }: { onBack: () => void }) {
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (newPassword.length < 8) return setError('New password must be at least 8 characters.')
    setSaving(true); setError('')
    const { error: err } = await changePassword(newPassword)
    setSaving(false)
    if (err) return setError(err.message)
    setDone(true)
  }

  return (
    <ScreenShell title="Change password" onBack={onBack}>
      {done ? (
        <p className="text-[14px] text-success-text font-semibold">Password changed.</p>
      ) : (
        <>
          <ErrorBanner message={error} />
          <TextField label="New password" type="password" value={newPassword} onChange={setNewPassword} placeholder="At least 8 characters" />
          <PrimaryButton onClick={submit} loading={saving} disabled={!newPassword}>Change password</PrimaryButton>
        </>
      )}
    </ScreenShell>
  )
}

function ChangeEmailScreen({ currentEmail, onBack }: { currentEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async () => {
    if (!email.trim() || !email.includes('@')) return setError('Enter a valid email address.')
    setSaving(true); setError('')
    const { error: err } = await requestEmailChange(email.trim())
    setSaving(false)
    if (err) return setError(err.message)
    setSent(true)
  }

  return (
    <ScreenShell title="Change email" onBack={onBack}>
      <p className="text-[13px] text-ink-secondary mb-4">Current email: {currentEmail}</p>
      {sent ? (
        <p className="text-[13.5px] text-success-text leading-relaxed">Check <b>{email}</b> for a confirmation link — your email only changes once you click it.</p>
      ) : (
        <>
          <ErrorBanner message={error} />
          <TextField label="New email address" value={email} onChange={setEmail} placeholder="you@example.com" />
          <PrimaryButton onClick={submit} loading={saving} disabled={!email}>Send verification link</PrimaryButton>
        </>
      )}
    </ScreenShell>
  )
}

function OrganisationScreen({ org, onBack, onChanged }: { org: any; onBack: () => void; onChanged: () => void }) {
  const { user } = useAuth()
  const [name, setName] = useState(org?.name || '')
  const [staff, setStaff] = useState<any[]>([])
  const [savingName, setSavingName] = useState(false)
  const [savingLead, setSavingLead] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setName(org?.name || '') }, [org?.name])
  useEffect(() => { if (user?.organisation_id) getOrgStaff(user.organisation_id).then(({ data }) => setStaff(data || [])) }, [user?.organisation_id])

  const saveName = async () => {
    if (!org || !name.trim()) return
    setSavingName(true); setError(''); setNotice('')
    const { error: err } = await updateOrganisationProfile(org.id, { name: name.trim() })
    setSavingName(false)
    if (err) return setError(err.message)
    setNotice('Organisation name updated.')
    onChanged()
  }

  const onLogoChosen = async (file: File | null) => {
    if (!file || !user || !org) return
    setUploadingLogo(true); setError(''); setNotice('')
    const { path, error: upErr } = await uploadOrgLogo(user.id, file)
    if (upErr || !path) { setUploadingLogo(false); setError(upErr?.message || 'Logo upload failed.'); return }
    const { error: err } = await updateOrganisationProfile(org.id, { logo_path: path })
    setUploadingLogo(false)
    if (err) return setError(err.message)
    onChanged()
  }

  const changeLead = async (leadId: string) => {
    if (!org) return
    setSavingLead(true); setError(''); setNotice('')
    const { error: err } = await updateOrganisationProfile(org.id, { safeguarding_lead_id: leadId })
    setSavingLead(false)
    if (err) return setError(err.message)
    setNotice('Safeguarding lead updated.')
    onChanged()
  }

  const logoUrl = org?.logo_path ? getAvatarUrl(org.logo_path) : null

  return (
    <ScreenShell title="Organisation" onBack={onBack}>
      <ErrorBanner message={error} />
      {notice && <p className="text-[13px] text-success-text font-semibold mb-3">{notice}</p>}

      <div className="flex items-center gap-3.5 mb-5">
        <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo} className="relative flex-shrink-0 disabled:opacity-60" aria-label="Change organisation logo">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-14 h-14 rounded-2xl object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-accent-bg text-brand font-bold text-[16px] flex items-center justify-center">{org?.name?.[0]?.toUpperCase() || 'O'}</div>
          )}
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand flex items-center justify-center border-2 border-surface">
            <Camera className="w-3 h-3 text-white" />
          </span>
        </button>
        <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => onLogoChosen(e.target.files?.[0] || null)} />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink">{uploadingLogo ? 'Uploading…' : 'Organisation logo'}</p>
          <p className="text-[12px] text-ink-tertiary leading-relaxed">Shown wherever your courses, briefs and workshops appear to students.</p>
          {org?.verified ? (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold mt-1" style={{ color: '#4a9de0' }}>
              <BadgeCheck className="w-3.5 h-3.5" /> Verified organisation
            </span>
          ) : (
            <p className="text-[11px] text-ink-quaternary mt-1">Not yet verified by LERN</p>
          )}
        </div>
      </div>

      <TextField label="Organisation name" value={name} onChange={setName} />
      <SecondaryButton onClick={saveName} disabled={savingName}>{savingName ? 'Saving…' : 'Save name'}</SecondaryButton>

      <label className="block mt-5 mb-5">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink mb-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Safeguarding lead
        </span>
        <select
          value={org?.safeguarding_lead_id || ''} onChange={e => changeLead(e.target.value)} disabled={savingLead}
          className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition"
        >
          <option value="" disabled>Choose a staff member…</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </label>

      <div className="mb-5">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink mb-2"><Users2 className="w-3.5 h-3.5" /> Staff ({staff.length})</p>
        <div className="space-y-1.5">
          {staff.map(s => (
            <div key={s.id} className="flex items-center justify-between text-[13px] px-3 py-2 bg-surface-subtle rounded-lg">
              <span className="text-ink">{s.full_name}</span>
              {org?.safeguarding_lead_id === s.id && <span className="text-[11px] font-semibold text-brand">Safeguarding lead</span>}
            </div>
          ))}
        </div>
        <p className="text-[12px] text-ink-tertiary mt-2">Removing a staff member's access isn't built yet — for now, contact us if someone needs to be removed.</p>
      </div>

      <div className="pt-4 border-t border-edge-subtle mb-6">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink mb-3"><Ticket className="w-3.5 h-3.5" /> Staff join codes</p>
        <JoinCodesPanel roleType="staff" />
      </div>

      <div className="pt-4 border-t border-edge-subtle">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink mb-3"><Ticket className="w-3.5 h-3.5" /> Student join codes</p>
        <JoinCodesPanel roleType="student" />
      </div>
    </ScreenShell>
  )
}

function BlockedAccountsScreen({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => { setLoading(true); getBlockedUsers(userId).then(({ data }) => { setRows(data || []); setLoading(false) }) }
  useEffect(load, [userId])

  return (
    <ScreenShell title="Blocked accounts" onBack={onBack}>
      {loading ? (
        <p className="text-[13px] text-ink-tertiary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-10">
          <UserX className="w-7 h-7 text-ink-quaternary mx-auto mb-2.5" />
          <p className="text-[13px] text-ink-tertiary">Nobody's blocked. Block someone from their profile and they'll show up here.</p>
        </div>
      ) : (
        <div className="divide-y divide-edge-subtle -mx-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between px-2 py-3">
              <span className="text-[14px] text-ink">{r.blocked?.full_name || 'A user'}</span>
              <button onClick={async () => { await unblockUser(r.id); load() }} className="text-[13px] font-semibold text-brand">Unblock</button>
            </div>
          ))}
        </div>
      )}
    </ScreenShell>
  )
}

function ReportScreen({ userId, organisationId, onBack }: { userId: string; organisationId: string | null; onBack: () => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const send = async () => {
    if (!reason.trim()) return setError('Describe what happened.')
    setLoading(true); setError('')
    const { error: err } = await submitReport(userId, organisationId, 'general', reason.trim())
    setLoading(false)
    if (err) return setError(err.message)
    setSent(true); setReason('')
  }

  return (
    <ScreenShell title="Report a problem" onBack={onBack}>
      <p className="text-[13px] text-ink-secondary mb-4 leading-relaxed">
        Something wrong with content or a person on LERN, or something that worries you? Tell us here — a human reviews every report, never an automated ban. Concerns about an adult at LERN follow the independent safeguarding route, not your organisation.
      </p>
      {sent && <p className="text-[13px] text-success-text font-semibold mb-3">Sent — thank you. A person will look at this.</p>}
      <ErrorBanner message={error} />
      <label className="block mb-4">
        <span className="block text-[13px] font-semibold text-ink-secondary mb-1.5">What happened?</span>
        <textarea
          value={reason} onChange={e => setReason(e.target.value)} rows={4}
          className="w-full bg-surface border border-edge rounded-xl px-4 py-3 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none"
        />
      </label>
      <PrimaryButton onClick={send} loading={loading}>Send report</PrimaryButton>
    </ScreenShell>
  )
}

function ConsentScreen({ consentedAt, onBack, onDelete }: { consentedAt?: string; onBack: () => void; onDelete: () => void }) {
  return (
    <ScreenShell title="Consent" onBack={onBack}>
      <p className="text-[14px] leading-relaxed text-ink mb-4">
        {consentedAt
          ? `You agreed to LERN's Terms of Service and Privacy Policy on ${new Date(consentedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
          : "We don't have a record of when you agreed to LERN's Terms of Service and Privacy Policy."}
      </p>
      <p className="text-[13px] text-ink-secondary leading-relaxed mb-5">
        To withdraw your consent, delete your account — using LERN depends on having agreed to these, so withdrawing means the account itself is deleted.
      </p>
      <button onClick={onDelete} className="flex items-center gap-1.5 text-[13px] font-semibold text-danger-text hover:underline">
        Delete my account
      </button>
    </ScreenShell>
  )
}

function DeleteAccountScreen({ email, onBack }: { email: string; onBack: () => void }) {
  const router = useRouter()
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const doDelete = async () => {
    if (confirmText !== email) return setError('Type your email exactly to confirm.')
    setDeleting(true); setError('')
    const { error: err } = await deleteMyAccount()
    if (err) { setDeleting(false); return setError(err.message) }
    await signOut()
    router.replace('/auth/login')
  }

  return (
    <ScreenShell title="Delete my account" onBack={onBack}>
      <p className="text-[13px] text-danger-text font-semibold mb-4 leading-relaxed">
        This permanently deletes your account and everything attached to it. It can't be undone.
      </p>
      <ErrorBanner message={error} />
      <TextField label={`Type "${email}" to confirm`} value={confirmText} onChange={setConfirmText} placeholder={email} />
      <button
        onClick={doDelete} disabled={deleting || confirmText !== email}
        className="w-full bg-danger-solid text-white font-semibold text-[14px] py-3 rounded-xl disabled:opacity-40 hover:bg-danger-solid-hover transition"
      >
        {deleting ? 'Deleting…' : 'Permanently delete'}
      </button>
    </ScreenShell>
  )
}

// ── Admin: DBS status and session log ──────────────────────────────
// Build Spec v1.0, 8 Sep 2026. Deliberately narrow: LERN's own adults
// who deliver live sessions, never institution staff (DBS-checked by
// their institution) and never visible outside this one admin gate.
// The frequency count and threshold flags are computed server-side by
// lern_adult_frequency() from the session log itself, never entered
// by hand -- this screen only ever displays what that function says.
function AdminSafeguardingScreen({ onBack }: { onBack: () => void }) {
  const [adults, setAdults] = useState<LernDeliveryAdult[]>([])
  const [freq, setFreq] = useState<Record<string, LernAdultFrequency>>({})
  const [log, setLog] = useState<LernSessionLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const load = async () => {
    const [{ data: adultRows }, { data: logRows }] = await Promise.all([
      getLernDeliveryAdults(), getLernSessionLog(),
    ])
    setAdults(adultRows || [])
    setLog(logRows || [])
    const entries = await Promise.all(
      (adultRows || []).map(async a => [a.id, (await getLernAdultFrequency(a.id)).data] as const)
    )
    setFreq(Object.fromEntries(entries.filter(([, f]) => f)))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const exportLog = () => {
    const header = 'Session,Mode,Delivered by,Delivered to under-18s,Date,Cancellation\n'
    const rows = log.map(l => [
      l.session_title, l.mode === 'online' ? 'Online' : 'In-person', l.adult?.full_name || '',
      l.delivered_to_minors ? 'Yes' : 'No', l.session_date, l.is_cancellation ? 'Yes' : 'No',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `lern-session-log-${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-ink-secondary hover:text-ink transition mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to Settings
      </button>
      <p className="text-[22px] font-bold text-ink mb-4">Session delivery & safeguarding</p>

      <div className="flex items-start gap-2.5 rounded-xl px-4 py-3.5 mb-5" style={{ backgroundColor: '#E6F1FB' }}>
        <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#185FA5' }} />
        <p className="text-[13px] leading-relaxed" style={{ color: '#0C447C' }}>
          Admin only. This covers LERN adults who deliver live sessions to under-18s. Institution staff are DBS-checked by their institution and do not appear here.
        </p>
      </div>

      {loading ? (
        <p className="text-[14px] text-ink-tertiary">Loading…</p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[16px] font-bold text-ink">LERN adults delivering live sessions</p>
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {adding && <AddAdultForm onDone={() => { setAdding(false); load() }} onCancel={() => setAdding(false)} />}

          <div className="space-y-3 mb-8">
            {adults.map(a => (
              <AdultCard key={a.id} adult={a} frequency={freq[a.id]} onChanged={load} />
            ))}
            {adults.length === 0 && !adding && (
              <p className="text-[14px] text-ink-tertiary bg-surface border border-edge rounded-2xl px-5 py-8 text-center">
                No LERN adults on the roster yet — add whoever delivers live sessions.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-[16px] font-bold text-ink">Session log</p>
            <button onClick={exportLog} disabled={log.length === 0} className="flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline disabled:opacity-40">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
          <div className="bg-surface border border-edge rounded-2xl overflow-hidden">
            {log.length === 0 ? (
              <p className="text-[14px] text-ink-tertiary px-5 py-8 text-center">No sessions logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-edge-subtle text-left">
                      <th className="px-4 py-2.5 font-semibold text-ink-tertiary">Session</th>
                      <th className="px-4 py-2.5 font-semibold text-ink-tertiary">Delivered by</th>
                      <th className="px-4 py-2.5 font-semibold text-ink-tertiary">Date</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const alreadyCancelled = new Set(log.map(l => l.cancelled_log_id).filter(Boolean))
                      return log.map(l => (
                        <tr key={l.id} className="border-b border-edge-subtle last:border-0">
                          <td className="px-4 py-2.5 text-ink">
                            {l.session_title} <span className="text-ink-tertiary">({l.mode === 'online' ? 'online' : 'in-person'})</span>
                            {l.is_cancellation && <span className="ml-1.5 text-[11px] font-semibold text-danger-text">Cancelled</span>}
                          </td>
                          <td className="px-4 py-2.5 text-ink-secondary">{l.adult?.full_name || '—'}</td>
                          <td className="px-4 py-2.5 text-ink-secondary">{new Date(l.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                          <td className="px-4 py-2.5 text-right">
                            {!l.is_cancellation && !alreadyCancelled.has(l.id) && (
                              <CancelLogButton entry={l} onCancelled={() => load()} />
                            )}
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-[12px] text-ink-quaternary mt-3 leading-relaxed">
            The log records who delivered each live session and when, so the frequency count is accurate and evidenced. No DBS certificates are stored here, only the checked status and date.
          </p>
        </>
      )}
    </div>
  )
}

function AdultCard({ adult, frequency, onChanged }: { adult: LernDeliveryAdult; frequency?: LernAdultFrequency; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [settingDate, setSettingDate] = useState(false)
  const [dateInput, setDateInput] = useState(new Date().toISOString().split('T')[0])

  // Threshold copy is deliberately conservative: warns from 2 days/30
  // onward, not only once it's already been crossed -- "before it is
  // crossed" is the whole point of a warning.
  const approaching = !adult.dbs_checked && (frequency?.days_in_30 || 0) >= 2 && !frequency?.is_regulated
  const crossed = !adult.dbs_checked && !!frequency?.is_regulated

  const toggleDbs = async (checked: boolean) => {
    if (checked) { setSettingDate(true); return }
    setBusy(true); setError('')
    const { error: err } = await updateLernDeliveryAdult(adult.id, { dbs_checked: false, dbs_checked_at: null })
    setBusy(false)
    if (err) { setError("Couldn't update — try again."); return }
    onChanged()
  }
  const confirmDbsDate = async () => {
    setBusy(true); setError('')
    const { error: err } = await updateLernDeliveryAdult(adult.id, { dbs_checked: true, dbs_checked_at: dateInput })
    setBusy(false)
    setSettingDate(false)
    if (err) { setError("Couldn't update — try again."); return }
    onChanged()
  }

  return (
    <div className="bg-surface border border-edge rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
            {adult.full_name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink truncate">{adult.full_name}</p>
            <p className="text-[12.5px] text-ink-tertiary truncate">{adult.role_label}</p>
          </div>
        </div>
        <button
          onClick={() => toggleDbs(!adult.dbs_checked)} disabled={busy}
          className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full transition disabled:opacity-50"
          style={adult.dbs_checked ? { backgroundColor: '#E1F5EE', color: '#0F6E56' } : { backgroundColor: '#FAEEDA', color: '#854F0B' }}
        >
          {adult.dbs_checked ? 'DBS checked' : 'DBS not yet checked'}
        </button>
      </div>

      {settingDate && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-edge-subtle">
          <input
            type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
            className="bg-surface-subtle border border-edge rounded-lg px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand"
          />
          <button onClick={confirmDbsDate} disabled={busy} className="text-[12.5px] font-semibold text-brand disabled:opacity-50">Confirm checked</button>
          <button onClick={() => setSettingDate(false)} className="text-[12.5px] font-semibold text-ink-tertiary">Cancel</button>
        </div>
      )}

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-edge-subtle text-[13px]">
        <p className="text-ink-secondary">Delivers to under-18s: <span className="font-semibold text-ink">{adult.delivers_to_minors ? 'Yes' : 'No'}</span></p>
        <p className="text-ink-secondary">Frequency: <span className="font-semibold" style={{ color: crossed ? '#B3401E' : approaching ? '#854F0B' : undefined }}>{frequency ? `${frequency.days_in_30} days / 30` : '—'}</span></p>
        {adult.dbs_checked && adult.dbs_checked_at && (
          <p className="text-ink-secondary">Checked: <span className="font-semibold text-ink">{new Date(adult.dbs_checked_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span></p>
        )}
      </div>

      {(approaching || crossed || frequency?.is_weekly || frequency?.has_overnight) && (
        <div className="flex items-start gap-1.5 mt-2.5 pt-2.5 border-t border-edge-subtle" style={{ color: crossed || frequency?.is_weekly || frequency?.has_overnight ? '#B3401E' : '#854F0B' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p className="text-[12.5px] leading-relaxed">
            {crossed || frequency?.is_weekly || frequency?.has_overnight
              ? `This meets the regulated-activity threshold${frequency?.is_weekly ? ' (weekly pattern)' : frequency?.has_overnight ? ' (overnight session)' : ''} — Enhanced DBS is required now.`
              : 'Approaching the regulated-activity threshold (3 days / 30). Enhanced DBS needed before it is crossed.'}
          </p>
        </div>
      )}
      {error && <p className="text-[12px] text-danger-text mt-2">{error}</p>}
    </div>
  )
}

// The log itself is append-only (the DB trigger enforces it regardless
// of what this button does) -- this never edits or removes the
// original row, it writes a NEW one recording that the session was
// cancelled, exactly as the spec requires.
function CancelLogButton({ entry, onCancelled }: { entry: LernSessionLogEntry; onCancelled: () => void }) {
  const [busy, setBusy] = useState(false)
  const cancel = async () => {
    if (!confirm(`Record "${entry.session_title}" as cancelled? The original entry stays in the log.`)) return
    setBusy(true)
    const { error } = await recordLernSessionCancellation(entry.id, entry.adult_id, entry.session_title, entry.mode)
    setBusy(false)
    if (error) { alert("Couldn't record that — try again."); return }
    onCancelled()
  }
  return (
    <button onClick={cancel} disabled={busy} aria-label="Record as cancelled" className="text-ink-tertiary hover:text-danger-text transition disabled:opacity-40">
      <Ban className="w-3.5 h-3.5" />
    </button>
  )
}

function AddAdultForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState('')
  const [roleLabel, setRoleLabel] = useState('')
  const [deliversToMinors, setDeliversToMinors] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!fullName.trim() || !roleLabel.trim()) return setError('Enter a name and their role.')
    setSaving(true); setError('')
    const { error: err } = await addLernDeliveryAdult({ full_name: fullName.trim(), role_label: roleLabel.trim(), delivers_to_minors: deliversToMinors })
    setSaving(false)
    if (err) { setError("Couldn't add them — try again."); return }
    onDone()
  }

  return (
    <div className="bg-surface border border-edge rounded-2xl p-4 mb-3">
      <TextField label="Full name" value={fullName} onChange={setFullName} placeholder="e.g. Rina Mehta" />
      <TextField label="Role at LERN" value={roleLabel} onChange={setRoleLabel} placeholder="e.g. Workshop host" />
      <label className="flex items-center gap-2 text-[13px] text-ink-secondary mb-3 -mt-1">
        <input type="checkbox" checked={deliversToMinors} onChange={e => setDeliversToMinors(e.target.checked)} />
        Delivers live sessions to under-18s
      </label>
      {error && <p className="text-[12px] text-danger-text mb-2">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving} className="bg-brand text-white text-[13px] font-semibold px-4 py-2 rounded-lg disabled:opacity-40">
          {saving ? 'Adding…' : 'Add to roster'}
        </button>
        <button onClick={onCancel} className="text-[13px] font-semibold text-ink-tertiary px-2">Cancel</button>
      </div>
    </div>
  )
}
