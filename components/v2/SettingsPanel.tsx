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
} from '@/lib/supabase'
import { TextField, PrimaryButton, SecondaryButton, ErrorBanner } from '@/components/v2/Field'
import {
  Sun, Moon, Monitor, ShieldCheck, Users2, Ticket,
  Mail, UserX, ChevronRight, ChevronLeft, Camera, BadgeCheck, LogOut,
} from 'lucide-react'
import JoinCodesPanel from '@/components/v2/JoinCodesPanel'

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

type Screen = null | 'email' | 'password' | 'photo' | 'rename' | 'organisation' | 'blocked' | 'report' | 'delete' | 'consent'

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
