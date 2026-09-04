'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  updateUserProfile, changePassword, setThemePreference, setNotificationPrefs,
  exportMyData, deleteMyAccount, submitReport, signOut,
  getOrgStaff, updateOrganisationProfile, supabase,
  requestEmailChange, sendPasswordResetEmail, signOutEverywhere,
  getBlockedUsers, unblockUser, setCookieConsent,
} from '@/lib/supabase'
import { TextField, PrimaryButton, SecondaryButton, ErrorBanner } from '@/components/v2/Field'
import {
  User, Lock, Sun, Moon, Monitor, Bell, Download, Trash2, Flag,
  FileText, LogOut, ShieldCheck, Users2, Ticket, KeyRound, Smartphone,
  Mail, UserX, Cookie, ChevronRight, ChevronLeft,
} from 'lucide-react'
import JoinCodesPanel from '@/components/v2/JoinCodesPanel'

// Brought up to the same depth as the student app's own Settings, per
// direct request ("you see how student have alot in there settings
// for org make the relevant things that they need") -- same
// underlying account/security/privacy/data machinery every role
// already shares on the users table (two_step_enabled, cookie_consent,
// consented_at, notification_prefs, blocked_users), just presented in
// this shell's own card language rather than the student app's list-
// row one. The Organisation card stays institution/provider-only --
// staff rosters, a safeguarding lead and join codes are real concepts
// there and not for a single-person employer account; an employer
// gets everything else here in the same style instead of an invented
// "company profile" that doesn't map to anything in the schema.
const NOTIFICATION_LABELS: Record<string, string> = {
  work_submitted: 'Work submitted for review',
  work_verified: 'Work verified',
  employer_interest: 'Employer interest',
  reports: 'New reports',
}

function Card({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-edge rounded-2xl p-6">
      <p className="font-bold text-ink text-[15px] mb-4 flex items-center gap-2">
        <Icon className="w-4 h-4 text-ink-tertiary" /> {title}
      </p>
      {children}
    </div>
  )
}

type Screen = null | 'email' | 'blocked' | 'delete' | 'consent'

export default function SettingsPanel() {
  const { user } = useAuth()
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>(null)
  const isOrgAdmin = user?.role === 'institution_staff' || user?.role === 'provider_staff'

  if (!user) return null

  if (screen === 'email') return <ChangeEmailScreen currentEmail={user.email} onBack={() => setScreen(null)} />
  if (screen === 'blocked') return <BlockedAccountsScreen userId={user.id} onBack={() => setScreen(null)} />
  if (screen === 'delete') return <DeleteAccountScreen email={user.email} onBack={() => setScreen(null)} />
  if (screen === 'consent') return <ConsentScreen consentedAt={user.consented_at} onBack={() => setScreen(null)} onDelete={() => setScreen('delete')} />

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <AccountCard onChangeEmail={() => setScreen('email')} />
      <SecurityCard onBlockedAccounts={() => setScreen('blocked')} />
      <ThemeCard />
      <NotificationsCard />
      <ReportCard />
      <DataPrivacyCard onViewConsent={() => setScreen('consent')} onDelete={() => setScreen('delete')} />
      {isOrgAdmin && <OrganisationCard />}
      <LegalCard />

      <button
        onClick={async () => { await signOut(); router.replace('/auth/login') }}
        className="flex items-center gap-2 text-[13px] font-semibold text-danger-text hover:underline"
      >
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </div>
  )
}

function AccountCard({ onChangeEmail }: { onChangeEmail: () => void }) {
  const { user, refreshUser } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [newPassword, setNewPassword] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const saveName = async () => {
    if (!user || !fullName.trim()) return
    setSavingName(true); setError(''); setNotice('')
    const { error: err } = await updateUserProfile(user.id, { full_name: fullName.trim() })
    setSavingName(false)
    if (err) return setError(err.message)
    await refreshUser()
    setNotice('Name updated.')
  }

  const savePassword = async () => {
    if (newPassword.length < 8) return setError('New password must be at least 8 characters.')
    setSavingPassword(true); setError(''); setNotice('')
    const { error: err } = await changePassword(newPassword)
    setSavingPassword(false)
    if (err) return setError(err.message)
    setNewPassword('')
    setNotice('Password changed.')
  }

  return (
    <Card icon={User} title="Account">
      <ErrorBanner message={error} />
      {notice && <p className="text-[13px] text-success-text font-semibold mb-3">{notice}</p>}
      <TextField label="Full name" value={fullName} onChange={setFullName} placeholder="Your name" />
      <SecondaryButton onClick={saveName} disabled={savingName}>{savingName ? "Saving…" : "Save name"}</SecondaryButton>

      <button onClick={onChangeEmail} className="w-full flex items-center justify-between mt-2 mb-4 py-2 text-left group">
        <span>
          <span className="block text-[13px] font-semibold text-ink mb-0.5">Email</span>
          <span className="text-[14px] text-ink-secondary">{user?.email}</span>
        </span>
        <ChevronRight className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
      </button>

      <div className="flex items-center gap-2 mb-1.5">
        <Lock className="w-3.5 h-3.5 text-ink-tertiary" />
        <span className="text-[13px] font-semibold text-ink">Change password</span>
      </div>
      <TextField label="" value={newPassword} onChange={setNewPassword} type="password" placeholder="New password (min 8 characters)" />
      <SecondaryButton onClick={savePassword} disabled={savingPassword || !newPassword}>{savingPassword ? "Changing…" : "Change password"}</SecondaryButton>
    </Card>
  )
}

function SecurityCard({ onBlockedAccounts }: { onBlockedAccounts: () => void }) {
  const { user, refreshUser } = useAuth()
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const requestReset = async () => {
    if (!user) return
    setBusy('reset')
    await sendPasswordResetEmail(user.email)
    setBusy(null)
    setNotice(`A password reset link has been sent to ${user.email}.`)
  }

  const toggleTwoStep = async () => {
    if (!user) return
    setBusy('two_step')
    await updateUserProfile(user.id, { two_step_enabled: !user.two_step_enabled })
    await refreshUser()
    setBusy(null)
  }

  const signOutAll = async () => {
    if (!confirm('Sign out of every device you’re signed in on?')) return
    setBusy('signout_all')
    await signOutEverywhere()
    window.location.href = '/auth/login'
  }

  return (
    <Card icon={KeyRound} title="Security and sign-in">
      {notice && <p className="text-[13px] text-success-text font-semibold mb-3">{notice}</p>}
      <div className="space-y-1 -mx-2">
        <button onClick={requestReset} disabled={busy === 'reset'} className="w-full flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-surface-muted transition text-left disabled:opacity-60">
          <span className="text-[13.5px] text-ink">{busy === 'reset' ? 'Sending…' : 'Reset password by email'}</span>
          <ChevronRight className="w-4 h-4 text-ink-tertiary" />
        </button>
        <div className="flex items-center justify-between px-2 py-2.5">
          <div className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-ink-tertiary" />
            <span className="text-[13.5px] text-ink">Two-step verification</span>
          </div>
          <button
            onClick={toggleTwoStep} disabled={busy === 'two_step'}
            className={`w-11 h-6 rounded-full transition relative flex-shrink-0 disabled:opacity-50 border ${user?.two_step_enabled ? 'bg-brand border-brand' : 'bg-surface-muted border-edge'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${user?.two_step_enabled ? 'left-[21px]' : 'left-0.5'}`} />
          </button>
        </div>
        <button onClick={signOutAll} disabled={busy === 'signout_all'} className="w-full flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-surface-muted transition text-left disabled:opacity-60">
          <span className="text-[13.5px] text-danger-text">{busy === 'signout_all' ? 'Signing out…' : 'Sign out of all devices'}</span>
        </button>
        <button onClick={onBlockedAccounts} className="w-full flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-surface-muted transition text-left">
          <span className="text-[13.5px] text-ink">Blocked accounts</span>
          <ChevronRight className="w-4 h-4 text-ink-tertiary" />
        </button>
      </div>
    </Card>
  )
}

function ThemeCard() {
  const { user, refreshUser } = useAuth()
  const [saving, setSaving] = useState(false)
  const current = user?.theme_preference || 'system'

  const choose = async (theme: 'light' | 'dark' | 'system') => {
    if (!user) return
    setSaving(true)
    await setThemePreference(user.id, theme)
    await refreshUser()
    setSaving(false)
  }

  return (
    <Card icon={Sun} title="Theme">
      <div className="flex gap-2">
        {([['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]] as const).map(([key, label, Icon]) => (
          <button
            key={key} onClick={() => choose(key)} disabled={saving}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold transition ${
              current === key ? 'bg-brand text-white' : 'bg-surface-subtle border border-edge text-ink-secondary'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>
    </Card>
  )
}

function NotificationsCard() {
  const { user, refreshUser } = useAuth()
  const [saving, setSaving] = useState<string | null>(null)
  const prefs = user?.notification_prefs || { work_submitted: true, work_verified: true, employer_interest: true, reports: true }
  const pushOn = prefs.push_enabled !== false
  const emailOn = prefs.email_enabled !== false

  const toggle = async (key: string, value?: boolean) => {
    if (!user) return
    const next = { ...prefs, [key]: value ?? !prefs[key] }
    setSaving(key)
    await setNotificationPrefs(user.id, next)
    await refreshUser()
    setSaving(null)
  }

  return (
    <Card icon={Bell} title="Notifications">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => toggle('push_enabled', !pushOn)} disabled={saving === 'push_enabled'}
          className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition ${pushOn ? 'bg-brand text-white' : 'bg-surface-subtle border border-edge text-ink-secondary'}`}
        >
          Push {pushOn ? 'on' : 'off'}
        </button>
        <button
          onClick={() => toggle('email_enabled', !emailOn)} disabled={saving === 'email_enabled'}
          className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition ${emailOn ? 'bg-brand text-white' : 'bg-surface-subtle border border-edge text-ink-secondary'}`}
        >
          Email {emailOn ? 'on' : 'off'}
        </button>
      </div>
      <div className="space-y-2.5 mb-3 pt-3 border-t border-edge-subtle">
        {Object.entries(NOTIFICATION_LABELS).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between">
            <span className="text-[13px] text-ink">{label}</span>
            <button
              onClick={() => toggle(key)} disabled={saving === key}
              className={`w-10 h-6 rounded-full transition relative flex-shrink-0 ${prefs[key] !== false ? 'bg-brand' : 'bg-edge'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${prefs[key] !== false ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </label>
        ))}
      </div>
    </Card>
  )
}

function ReportCard() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const send = async () => {
    if (!user) return
    if (!reason.trim()) return setError('Describe your concern.')
    setLoading(true); setError('')
    const { error: err } = await submitReport(user.id, user.organisation_id || null, 'general', reason.trim())
    setLoading(false)
    if (err) return setError(err.message)
    setSent(true); setReason(''); setOpen(false)
  }

  return (
    <Card icon={Flag} title="Raise a concern">
      <p className="text-[13px] text-ink-secondary mb-3">
        Something wrong with content or a person on LERN? Tell us here — a human reviews every report, never an automated ban.
        Concerns about an adult at LERN follow the independent safeguarding route, not your organisation.
      </p>
      {sent && <p className="text-[13px] text-success-text font-semibold mb-3">Sent — thank you. Someone will follow up.</p>}
      {!open ? (
        <SecondaryButton onClick={() => setOpen(true)}>Report a concern</SecondaryButton>
      ) : (
        <>
          <ErrorBanner message={error} />
          <textarea
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="What happened?" rows={3}
            className="w-full bg-surface border border-edge rounded-xl px-4 py-3 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition mb-3 resize-none"
          />
          <PrimaryButton onClick={send} loading={loading}>Send report</PrimaryButton>
        </>
      )}
    </Card>
  )
}

function DataPrivacyCard({ onViewConsent, onDelete }: { onViewConsent: () => void; onDelete: () => void }) {
  const { user, refreshUser } = useAuth()
  const [downloading, setDownloading] = useState(false)
  const [busy, setBusy] = useState(false)

  const download = async () => {
    if (!user) return
    setDownloading(true)
    const data = await exportMyData(user.id)
    setDownloading(false)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lern-my-data-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleAnalytics = async () => {
    if (!user) return
    setBusy(true)
    await setCookieConsent(user.id, !(user.cookie_consent?.analytics ?? false))
    await refreshUser()
    setBusy(false)
  }

  return (
    <Card icon={Download} title="Data and privacy">
      <p className="text-[13px] text-ink-secondary mb-4">Everything LERN holds about you, and your rights over it under UK GDPR.</p>
      <div className="flex flex-wrap gap-2 mb-4">
        <SecondaryButton onClick={download} disabled={downloading}>{downloading ? "Preparing…" : "Download my data"}</SecondaryButton>
        <SecondaryButton onClick={onViewConsent}>View consent</SecondaryButton>
      </div>
      <label className="flex items-center justify-between py-2 border-t border-edge-subtle">
        <span>
          <span className="block text-[13px] font-semibold text-ink">Analytics cookies</span>
          <span className="block text-[12px] text-ink-tertiary">Essential cookies are always on</span>
        </span>
        <button
          onClick={toggleAnalytics} disabled={busy}
          className={`w-11 h-6 rounded-full transition relative flex-shrink-0 disabled:opacity-50 border ${user?.cookie_consent?.analytics ? 'bg-brand border-brand' : 'bg-surface-muted border-edge'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${user?.cookie_consent?.analytics ? 'left-[21px]' : 'left-0.5'}`} />
        </button>
      </label>

      <div className="mt-4 pt-4 border-t border-edge-subtle">
        <button onClick={onDelete} className="flex items-center gap-1.5 text-[13px] font-semibold text-danger-text hover:underline">
          <Trash2 className="w-3.5 h-3.5" /> Delete my account and data
        </button>
      </div>
    </Card>
  )
}

function LegalCard() {
  return (
    <Card icon={FileText} title="Legal and support">
      <div className="flex flex-col gap-2.5 mb-4">
        <Link href="/legal/terms" className="text-[13px] font-semibold text-brand hover:underline">Terms of Service</Link>
        <Link href="/legal/privacy" className="text-[13px] font-semibold text-brand hover:underline">Data Protection</Link>
        <Link href="/legal/safeguarding" className="text-[13px] font-semibold text-brand hover:underline">Safeguarding</Link>
        <Link href="/legal/cookies" className="text-[13px] font-semibold text-brand hover:underline">Cookie Policy</Link>
      </div>
      <div className="pt-4 border-t border-edge-subtle flex items-center justify-between">
        <a href="mailto:support@lernapp.uk" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-brand transition">
          <Mail className="w-3.5 h-3.5" /> support@lernapp.uk
        </a>
        <span className="text-[12px] text-ink-quaternary">App version 1.0</span>
      </div>
    </Card>
  )
}

function OrganisationCard() {
  const { user } = useAuth()
  const [org, setOrg] = useState<any>(null)
  const [name, setName] = useState('')
  const [staff, setStaff] = useState<any[]>([])
  const [savingName, setSavingName] = useState(false)
  const [savingLead, setSavingLead] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    if (!user?.organisation_id) return
    supabase.from('organisations').select('*').eq('id', user.organisation_id).single().then(({ data }) => {
      setOrg(data); setName(data?.name || '')
    })
    getOrgStaff(user.organisation_id).then(({ data }) => setStaff(data || []))
  }
  useEffect(load, [user?.organisation_id])

  const saveName = async () => {
    if (!org || !name.trim()) return
    setSavingName(true); setError(''); setNotice('')
    const { error: err } = await updateOrganisationProfile(org.id, { name: name.trim() })
    setSavingName(false)
    if (err) return setError(err.message)
    setNotice('Organisation name updated.')
    load()
  }

  const changeLead = async (leadId: string) => {
    if (!org) return
    setSavingLead(true); setError(''); setNotice('')
    const { error: err } = await updateOrganisationProfile(org.id, { safeguarding_lead_id: leadId })
    setSavingLead(false)
    if (err) return setError(err.message)
    setNotice('Safeguarding lead updated.')
    load()
  }

  return (
    <Card icon={Users2} title="Organisation">
      <ErrorBanner message={error} />
      {notice && <p className="text-[13px] text-success-text font-semibold mb-3">{notice}</p>}

      <TextField label="Organisation name" value={name} onChange={setName} />
      <SecondaryButton onClick={saveName} disabled={savingName}>{savingName ? "Saving…" : "Save name"}</SecondaryButton>

      <label className="block mt-4 mb-5">
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
        <p className="text-[13px] font-semibold text-ink mb-2">Staff ({staff.length})</p>
        <div className="space-y-1.5">
          {staff.map(s => (
            <div key={s.id} className="flex items-center justify-between text-[13px] px-3 py-2 bg-surface-subtle rounded-lg">
              <span className="text-ink">{s.full_name}</span>
              {org?.safeguarding_lead_id === s.id && <span className="text-[11px] font-semibold text-brand">Safeguarding lead</span>}
            </div>
          ))}
        </div>
        <p className="text-[12px] text-ink-tertiary mt-2">Inviting new staff and removing existing staff isn't built yet — right now only whoever set up the organisation has staff access.</p>
      </div>

      <div className="pt-4 border-t border-edge-subtle">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink mb-3"><Ticket className="w-3.5 h-3.5" /> Join codes</p>
        <JoinCodesPanel />
      </div>
    </Card>
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
        <Trash2 className="w-3.5 h-3.5" /> Delete my account
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
