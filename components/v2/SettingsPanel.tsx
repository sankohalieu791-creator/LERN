'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  updateUserProfile, changePassword, setThemePreference, setNotificationPrefs,
  exportMyData, deleteMyAccount, submitReport, signOut,
  getOrgStaff, updateOrganisationProfile, supabase,
} from '@/lib/supabase'
import { TextField, PrimaryButton, SecondaryButton, ErrorBanner } from '@/components/v2/Field'
import {
  User, Lock, Sun, Moon, Monitor, Bell, Download, Trash2, Flag,
  FileText, LogOut, ShieldCheck, Users2, Ticket,
} from 'lucide-react'
import JoinCodesPanel from '@/components/v2/JoinCodesPanel'

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

export default function SettingsPanel() {
  const { user } = useAuth()
  const router = useRouter()
  const isOrgAdmin = user?.role === 'institution_staff' || user?.role === 'provider_staff'

  if (!user) return null

  return (
    <div className="max-w-4xl space-y-5">
      <AccountCard />
      <ThemeCard />
      <NotificationsCard />
      <ReportCard />
      <DataPrivacyCard />
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

function AccountCard() {
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
      <div className="mt-2 mb-4">
        <label className="block text-[13px] font-semibold text-ink mb-1.5">Email</label>
        <p className="text-[14px] text-ink-secondary">{user?.email}</p>
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <Lock className="w-3.5 h-3.5 text-ink-tertiary" />
        <span className="text-[13px] font-semibold text-ink">Change password</span>
      </div>
      <TextField label="" value={newPassword} onChange={setNewPassword} type="password" placeholder="New password (min 8 characters)" />
      <SecondaryButton onClick={savePassword} disabled={savingPassword || !newPassword}>{savingPassword ? "Changing…" : "Change password"}</SecondaryButton>
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
      <p className="text-[12px] text-ink-tertiary mt-3">Dark mode is still being finished across every screen — light is the safest choice until then.</p>
    </Card>
  )
}

function NotificationsCard() {
  const { user, refreshUser } = useAuth()
  const [saving, setSaving] = useState(false)
  const prefs = user?.notification_prefs || { work_submitted: true, work_verified: true, employer_interest: true, reports: true }

  const toggle = async (key: string) => {
    if (!user) return
    const next = { ...prefs, [key]: !prefs[key] }
    setSaving(true)
    await setNotificationPrefs(user.id, next)
    await refreshUser()
    setSaving(false)
  }

  return (
    <Card icon={Bell} title="Notifications">
      <div className="space-y-2.5 mb-3">
        {Object.entries(NOTIFICATION_LABELS).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between">
            <span className="text-[13px] text-ink">{label}</span>
            <button
              onClick={() => toggle(key)} disabled={saving}
              className={`w-10 h-6 rounded-full transition relative flex-shrink-0 ${prefs[key] ? 'bg-brand' : 'bg-edge'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${prefs[key] ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </label>
        ))}
      </div>
      <p className="text-[12px] text-ink-tertiary">These preferences are saved now and will govern email notifications once those go live.</p>
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

function DataPrivacyCard() {
  const { user } = useAuth()
  const router = useRouter()
  const [downloading, setDownloading] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

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

  const doDelete = async () => {
    if (confirmText !== user?.email) return setError('Type your email exactly to confirm.')
    setDeleting(true); setError('')
    const { error: err } = await deleteMyAccount()
    if (err) { setDeleting(false); return setError(err.message) }
    await signOut()
    router.replace('/auth/login')
  }

  return (
    <Card icon={Download} title="Data and privacy">
      <p className="text-[13px] text-ink-secondary mb-4">Everything LERN holds about you, and your rights over it under UK GDPR.</p>
      <SecondaryButton onClick={download} disabled={downloading}>{downloading ? "Preparing…" : "Download my data"}</SecondaryButton>

      <div className="mt-4 pt-4 border-t border-edge-subtle">
        <ErrorBanner message={error} />
        {!confirmingDelete ? (
          <button onClick={() => setConfirmingDelete(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-danger-text hover:underline">
            <Trash2 className="w-3.5 h-3.5" /> Delete my account and data
          </button>
        ) : (
          <div>
            <p className="text-[13px] text-danger-text font-semibold mb-2">This permanently deletes your account and everything attached to it. It can't be undone.</p>
            <TextField label={`Type "${user?.email}" to confirm`} value={confirmText} onChange={setConfirmText} placeholder={user?.email} />
            <div className="flex gap-2">
              <SecondaryButton onClick={() => setConfirmingDelete(false)}>Cancel</SecondaryButton>
              <button
                onClick={doDelete} disabled={deleting || confirmText !== user?.email}
                className="flex-1 bg-danger-solid text-white font-semibold text-[14px] py-3 rounded-xl disabled:opacity-40 hover:bg-danger-solid-hover transition"
              >
                {deleting ? 'Deleting…' : 'Permanently delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function LegalCard() {
  return (
    <Card icon={FileText} title="Legal">
      <div className="flex flex-col gap-2.5">
        <Link href="/legal/terms" className="text-[13px] font-semibold text-brand hover:underline">Terms of Service</Link>
        <Link href="/legal/privacy" className="text-[13px] font-semibold text-brand hover:underline">Privacy Policy</Link>
        <Link href="/legal/safeguarding" className="text-[13px] font-semibold text-brand hover:underline">Safeguarding</Link>
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
