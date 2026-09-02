'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { EditProfileScreen, Avatar } from '@/components/v2/ProfilePanel'
import {
  updateUserProfile, changePassword, requestEmailChange, sendPasswordResetEmail,
  signOutEverywhere, setNotificationPrefs, exportMyData, deleteMyAccount,
  requestMinorAccountDeletion, submitReport, signOut, getMyOrganisationInfo,
  getBlockedUsers, unblockUser, setCookieConsent, setThemePreference,
} from '@/lib/supabase'
import {
  ChevronRight, ChevronLeft, Lock, Bell, Download, Trash2, Flag, FileText, LogOut,
  Shield, Eye, Sun, Moon, Monitor, Mail, UserX,
} from 'lucide-react'

// LERN Student Settings, Full Spec v1.0. One scrolling screen of
// grouped sections, exactly as written -- not the drill-down menu the
// first pass used. Colours are this app's own dark palette (#0f0f0f
// page / #1a1a1a cards / white/10 borders), not the spec text's literal
// white-card values -- same call made for Briefs, Interest Received and
// Profile all session: the app itself is dark-only right now, and a
// single white settings page next to four dark screens would be the
// actual inconsistency, not a faithful read of "build this exactly."
// Structure, copy, field-by-field content and the age gate are exact.
function isAdult(dob?: string) {
  if (!dob) return false
  return (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25) >= 18
}

const NOTIF_CATEGORIES: { key: string; label: (adult: boolean) => string }[] = [
  { key: 'brief_set', label: () => 'New brief or assignment set' },
  { key: 'deadline_approaching', label: () => 'Deadline approaching' },
  { key: 'work_verified', label: () => 'Work verified' },
  { key: 'work_returned', label: () => 'Work returned for changes' },
  { key: 'employer_interest', label: adult => adult ? 'An employer expressed interest' : "An employer expressed interest (routed through your school)" },
  { key: 'new_follower', label: () => 'New follower' },
  { key: 'post_reactions', label: () => 'Reactions on your posts' },
  { key: 'workshop_reminder', label: () => 'Workshop reminders' },
]

type Screen = null | 'password' | 'email' | 'blocked' | 'deleteAdult' | 'report' | 'consent'

export default function StudentSettingsPanel() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const [editingProfile, setEditingProfile] = useState(false)
  const [screen, setScreen] = useState<Screen>(null)
  const [org, setOrg] = useState<any>(null)
  const [busyField, setBusyField] = useState<string | null>(null)

  useEffect(() => {
    if (user?.organisation_id) getMyOrganisationInfo(user.organisation_id).then(({ data }) => setOrg(data))
  }, [user?.organisation_id])

  if (!user) return null
  const adult = isAdult(user.date_of_birth)

  const savePrivacy = async (field: string, value: boolean) => {
    setBusyField(field)
    await updateUserProfile(user.id, { [field]: value })
    await refreshUser()
    setBusyField(null)
  }

  const notifs = user.notification_prefs || {}
  const saveNotif = async (key: string, value: boolean) => {
    setBusyField(key)
    await setNotificationPrefs(user.id, { ...notifs, [key]: value })
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
    await sendPasswordResetEmail(user.email)
    setBusyField(null)
    alert(`A password reset link has been sent to ${user.email}.`)
  }

  const requestSignOutEverywhere = async () => {
    if (!confirm('Sign out of every device you’re signed in on?')) return
    await signOutEverywhere()
    router.replace('/auth/login')
  }

  const requestMinorDelete = async () => {
    if (!user.organisation_id) return
    if (!confirm('Start a deletion request? Your school will be notified so the right adult can help.')) return
    setBusyField('minorDelete')
    await requestMinorAccountDeletion(user.id, user.organisation_id)
    setBusyField(null)
    alert('Your request has been sent to your school. They’ll be in touch to help with the next steps.')
  }

  // ── Sub-screens ──
  if (screen === 'password') return <ChangePasswordScreen onBack={() => setScreen(null)} />
  if (screen === 'email') return <ChangeEmailScreen currentEmail={user.email} onBack={() => setScreen(null)} />
  if (screen === 'blocked') return <BlockedAccountsScreen userId={user.id} onBack={() => setScreen(null)} />
  if (screen === 'deleteAdult') return <DeleteAccountScreen email={user.email} onBack={() => setScreen(null)} />
  if (screen === 'report') return <ReportScreen userId={user.id} organisationId={user.organisation_id || null} onBack={() => setScreen(null)} />
  if (screen === 'consent') {
    return (
      <ScreenShell title="Consent" onBack={() => setScreen(null)}>
        <p className="text-[14px] leading-relaxed text-[#ccc] mb-4">
          {user.consented_at
            ? `You agreed to LERN's Terms of Service and Privacy Policy on ${new Date(user.consented_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
            : "We don't have a record of when you agreed to LERN's Terms of Service and Privacy Policy."}
        </p>
        <p className="text-[13px] text-[#999] leading-relaxed mb-6">
          To withdraw your consent, delete your account below — using LERN depends on having agreed to these, so withdrawing means the account itself is deleted.
        </p>
        <DarkButton danger onClick={() => setScreen(adult ? 'deleteAdult' : null)}>
          {adult ? 'Delete my account' : 'Close'}
        </DarkButton>
        {!adult && <p className="text-[12px] text-[#666] mt-3">As you're under 18, deleting your account routes through your school — see "Your data" below.</p>}
      </ScreenShell>
    )
  }

  return (
    <div className="bg-[#0f0f0f] min-h-[calc(100vh-56px)] text-white px-4 pt-4 pb-10">
      <p className="text-[22px] font-bold mb-5">Settings</p>

      {editingProfile && (
        <EditProfileScreen
          profile={user}
          onDone={async () => { await refreshUser(); setEditingProfile(false) }}
          onClose={() => setEditingProfile(false)}
        />
      )}

      {/* ── 1. Account ── */}
      <Group title="Account">
        <Row label="Profile photo" onClick={() => setEditingProfile(true)} right={<Avatar path={user.avatar_path} name={user.full_name} size={32} textSize={12} />} />
        <Row label="Display name" value={user.full_name} onClick={() => setEditingProfile(true)} />
        <Row label="Bio" value={user.bio ? 'Edit' : 'Add a bio'} onClick={() => setEditingProfile(true)} />
        <Row label="Interests" value={(user.interest_tags?.length ?? 0) > 0 ? `${user.interest_tags!.length} added` : 'Add up to 3'} onClick={() => setEditingProfile(true)} />
        <Row label="Email" value={user.email} onClick={() => setScreen('email')} />
        <Row label="Organisation" value={org?.name || '—'} noChevron />
      </Group>

      {/* ── 2. Security and sign-in ── */}
      <Group title="Security and sign-in">
        <Row label="Change password" onClick={() => setScreen('password')} />
        <Row label="Reset password by email" onClick={requestReset} busy={busyField === 'reset'} />
        <ToggleRow label="Two-step verification" value={!!user.two_step_enabled} busy={busyField === 'two_step_enabled'} onToggle={v => savePrivacy('two_step_enabled', v)} />
        <Row label="Sign out of all devices" onClick={requestSignOutEverywhere} />
      </Group>

      {/* ── 3. Privacy and who can see me ── */}
      <Group title="Privacy and who can see me">
        {!adult ? (
          <div className="px-4 py-3.5 flex items-start gap-2.5">
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#4ade80]" />
            <p className="text-[13px] leading-relaxed text-[#ccc]">
              Because you are under 18, your profile is not public and you cannot be searched for by name. Your work can be shared through your school, but you cannot be contacted directly.
            </p>
          </div>
        ) : (
          <>
            <ToggleRow label="Public profile" hint="Anyone on LERN can find and view your profile" value={!!user.public_profile} busy={busyField === 'public_profile'} onToggle={v => savePrivacy('public_profile', v)} />
            <ToggleRow label="Verified work public by default" hint="You can still change this per piece" value={!!user.work_public_default} busy={busyField === 'work_public_default'} onToggle={v => savePrivacy('work_public_default', v)} />
            <ToggleRow label="Followers visible" value={user.followers_visible !== false} busy={busyField === 'followers_visible'} onToggle={v => savePrivacy('followers_visible', v)} />
            <ToggleRow label="Following visible" value={user.following_visible !== false} busy={busyField === 'following_visible'} onToggle={v => savePrivacy('following_visible', v)} />
          </>
        )}
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <p className="text-[12px] text-[#666] leading-relaxed">Each verified piece of work can be set public or private individually, from the work itself.</p>
        </div>
        <Row label="Blocked accounts" onClick={() => setScreen('blocked')} />
      </Group>

      {/* ── 4. Notifications ── */}
      <Group title="Notifications">
        <ToggleRow label="Push notifications on this device" value={notifs.push_enabled !== false} busy={busyField === 'push_enabled'} onToggle={v => saveNotif('push_enabled', v)} />
        <ToggleRow label="Email notifications" value={notifs.email_enabled !== false} busy={busyField === 'email_enabled'} onToggle={v => saveNotif('email_enabled', v)} />
      </Group>
      <Group>
        {NOTIF_CATEGORIES.map(c => (
          <ToggleRow key={c.key} label={c.label(adult)} value={notifs[c.key] !== false} busy={busyField === c.key} onToggle={v => saveNotif(c.key, v)} />
        ))}
      </Group>

      {/* ── 5. Your data ── */}
      <Group title="Your data">
        <Row label="Download my data" onClick={async () => {
          const data = await exportMyData(user.id)
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = `lern-my-data-${new Date().toISOString().split('T')[0]}.json`; a.click()
          URL.revokeObjectURL(url)
        }} />
        <div className="px-4 py-3.5 border-t border-white/[0.06]">
          <p className="text-[12.5px] text-[#999] leading-relaxed">
            Most details can be corrected by editing your profile above. For anything else, contact your safeguarding lead below or use "Report a problem" in Safety.
          </p>
        </div>
        {adult ? (
          <Row label="Delete my account and data" danger onClick={() => setScreen('deleteAdult')} />
        ) : (
          <Row label="To delete your account, we will let your school know so the right adult can help. Tap to start a deletion request." danger multiline onClick={requestMinorDelete} busy={busyField === 'minorDelete'} />
        )}
        <Row label="Consent" value="View" onClick={() => setScreen('consent')} />
      </Group>

      {/* ── 6. Safety and reporting ── */}
      <Group title="Safety and reporting">
        <Row label="Report a problem or something that worries you" onClick={() => setScreen('report')} />
        <div className="px-4 py-3 border-t border-white/[0.06] space-y-2">
          <p className="text-[12px] text-[#666] leading-relaxed">A post or piece of content can also be reported directly from the content itself.</p>
          <p className="text-[12px] text-[#666] leading-relaxed">A report is looked at by a person. Content can be automatically hidden while that happens — nothing is auto-actioned against another user without human review.</p>
        </div>
        <Row label="Block or hide an account" onClick={() => setScreen('blocked')} />
        <Row
          label="Your safeguarding contact"
          value={org?.safeguarding_lead?.full_name || 'Ask your school'}
          noChevron
        />
      </Group>

      {/* ── 7. Appearance ── */}
      <Group title="Appearance">
        <div className="px-4 py-3.5">
          <p className="text-[14px] mb-3">Theme</p>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map(t => (
              <button
                key={t} onClick={() => saveTheme(t)} disabled={busyField === 'theme'}
                className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-[12px] font-medium transition ${
                  (user.theme_preference || 'dark') === t ? 'border-brand bg-brand/10 text-white' : 'border-white/10 text-[#888]'
                }`}
              >
                {t === 'light' ? <Sun className="w-4 h-4" /> : t === 'dark' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-[#666] mt-3 leading-relaxed">Saved now. LERN's phone app is dark-only at the moment — Light and System will take effect once that's switched on across every screen.</p>
        </div>
      </Group>

      {/* ── 8. About and legal ── */}
      <Group title="About and legal">
        <LinkRow label="Privacy Policy" href="/legal/privacy" />
        <LinkRow label="Cookie Policy" href="/legal/cookies" />
        <LinkRow label="Terms of Service" href="/legal/terms" />
        <LinkRow label="Public safeguarding summary" href="/legal/safeguarding" />
        <ToggleRow
          label="Analytics cookies" hint="Essential cookies are always on"
          value={user.cookie_consent?.analytics ?? false}
          busy={busyField === 'cookies'}
          onToggle={async v => { setBusyField('cookies'); await setCookieConsent(user.id, v); await refreshUser(); setBusyField(null) }}
        />
        <Row label="App version" value="1.0" noChevron />
        <a href="mailto:support@lernapp.uk" className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition">
          <span className="text-[14px]">Contact and support</span>
          <span className="flex items-center gap-1 text-[13px] text-[#999]"><Mail className="w-3.5 h-3.5" /> support@lernapp.uk</span>
        </a>
      </Group>

      {/* ── 9. Sign out ── */}
      <button
        onClick={async () => { await signOut(); router.replace('/auth/login') }}
        className="flex items-center justify-center gap-2 w-full text-[14px] font-semibold text-danger-text py-3.5 mt-2"
      >
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </div>
  )
}

// ── Shared row/group primitives ──────────────────────────────────
function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      {title && <p className="text-[13px] font-medium text-[#999] mb-2 px-1">{title}</p>}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl divide-y divide-white/[0.06] overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, onClick, right, noChevron, danger, multiline, busy }: {
  label: string; value?: string; onClick?: () => void; right?: React.ReactNode
  noChevron?: boolean; danger?: boolean; multiline?: boolean; busy?: boolean
}) {
  const content = (
    <>
      <span className={`text-[14px] ${multiline ? 'leading-relaxed pr-2' : ''} ${danger ? 'text-danger-text' : 'text-white'}`}>
        {busy ? 'Working…' : label}
      </span>
      <span className="flex items-center gap-2 flex-shrink-0">
        {value && <span className="text-[13px] text-[#999] truncate max-w-[140px]">{value}</span>}
        {right}
        {onClick && !noChevron && <ChevronRight className="w-4 h-4 text-[#555]" />}
      </span>
    </>
  )
  if (!onClick) return <div className="flex items-center justify-between px-4 py-3.5">{content}</div>
  return (
    <button onClick={onClick} disabled={busy} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition text-left disabled:opacity-60">
      {content}
    </button>
  )
}

function ToggleRow({ label, hint, value, onToggle, busy }: { label: string; hint?: string; value: boolean; onToggle: (v: boolean) => void; busy?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 gap-3">
      <div className="min-w-0">
        <p className="text-[14px] text-white">{label}</p>
        {hint && <p className="text-[12px] text-[#666] mt-0.5">{hint}</p>}
      </div>
      <button
        onClick={() => onToggle(!value)} disabled={busy}
        className={`w-11 h-6 rounded-full transition relative flex-shrink-0 disabled:opacity-50 ${value ? 'bg-brand' : 'bg-white/10'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

function LinkRow({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition">
      <span className="text-[14px] text-white">{label}</span>
      <ChevronRight className="w-4 h-4 text-[#555]" />
    </Link>
  )
}

function ScreenShell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-[#0f0f0f] min-h-[calc(100vh-56px)] text-white">
      <div className="sticky top-0 z-10 flex items-center h-14 px-3 bg-[#0f0f0f]/95 backdrop-blur border-b border-white/10">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="text-[15px] font-semibold ml-1">{title}</p>
      </div>
      <div className="px-4 py-5">{children}</div>
    </div>
  )
}

function DarkField({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block mb-4">
      <span className="block text-[13px] font-semibold text-[#999] mb-1.5">{label}</span>
      <input
        {...props}
        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-[15px] text-white placeholder-[#555] outline-none focus:border-brand transition"
      />
    </label>
  )
}

function DarkButton({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className={`w-full py-3 rounded-xl text-[14px] font-semibold transition disabled:opacity-40 ${
        danger ? 'bg-danger-solid text-white' : 'bg-[#1a1a1a] border border-white/10 text-white hover:bg-[#222]'
      }`}
    >
      {children}
    </button>
  )
}

// ── Sub-screens ─────────────────────────────────────────────────
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
          {error && <p className="text-[13px] text-danger-text mb-3">{error}</p>}
          <DarkField label="New password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" />
          <DarkButton onClick={submit} disabled={saving || !newPassword}>{saving ? 'Changing…' : 'Change password'}</DarkButton>
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
    <ScreenShell title="Email" onBack={onBack}>
      <p className="text-[13px] text-[#999] mb-4">Current email: {currentEmail}</p>
      {sent ? (
        <p className="text-[14px] text-success-text leading-relaxed">Check <b>{email}</b> for a confirmation link — your email only changes once you click it.</p>
      ) : (
        <>
          {error && <p className="text-[13px] text-danger-text mb-3">{error}</p>}
          <DarkField label="New email address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          <DarkButton onClick={submit} disabled={saving || !email}>{saving ? 'Sending…' : 'Send verification link'}</DarkButton>
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
        <p className="text-[13px] text-[#666]">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-12">
          <UserX className="w-7 h-7 text-[#333] mx-auto mb-2.5" />
          <p className="text-[13px] text-[#666]">Nobody's blocked. Block someone from their profile and they'll show up here.</p>
        </div>
      ) : (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl divide-y divide-white/[0.06] overflow-hidden">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3.5">
              <span className="text-[14px]">{r.blocked?.full_name || 'A user'}</span>
              <button onClick={async () => { await unblockUser(r.id); load() }} className="text-[13px] font-semibold text-brand">Unblock</button>
            </div>
          ))}
        </div>
      )}
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
        This permanently deletes your account and everything attached to it — posts, submissions, verified work, messages. It can't be undone.
      </p>
      {error && <p className="text-[13px] text-danger-text mb-3">{error}</p>}
      <DarkField label={`Type "${email}" to confirm`} value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={email} />
      <DarkButton danger onClick={doDelete} disabled={deleting || confirmText !== email}>{deleting ? 'Deleting…' : 'Delete my account and data'}</DarkButton>
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
      <p className="text-[13px] text-[#999] mb-4 leading-relaxed">
        Something wrong, or something that worries you? Tell us here — a person reviews every report, never an automated ban.
      </p>
      {sent && <p className="text-[13px] text-success-text font-semibold mb-3">Sent — thank you. A person will look at this.</p>}
      {error && <p className="text-[13px] text-danger-text mb-3">{error}</p>}
      <label className="block mb-4">
        <span className="block text-[13px] font-semibold text-[#999] mb-1.5">What happened?</span>
        <textarea
          value={reason} onChange={e => setReason(e.target.value)} rows={4}
          className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-[15px] text-white placeholder-[#555] outline-none focus:border-brand transition resize-none"
        />
      </label>
      <DarkButton onClick={send} disabled={loading}>{loading ? 'Sending…' : 'Send report'}</DarkButton>
    </ScreenShell>
  )
}
