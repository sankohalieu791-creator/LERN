'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  updateUserProfile, changePassword, setNotificationPrefs,
  exportMyData, deleteMyAccount, submitReport, signOut,
} from '@/lib/supabase'
import {
  User, Lock, Bell, Download, Trash2, Flag, FileText, LogOut, ChevronRight,
} from 'lucide-react'

const NOTIFICATION_LABELS: Record<string, string> = {
  work_submitted: 'Work submitted for review',
  work_verified: 'Work verified',
  employer_interest: 'Employer interest',
  reports: 'New reports',
}

// Dark, mobile-native -- this app's own look (same palette as Feed/My
// Work/Discover/Profile), not the shared light desktop SettingsPanel
// used by institution/provider staff. Same underlying account/data
// functions either way, different chrome entirely: sectioned dark
// cards instead of a generic light settings page.
export default function StudentSettingsPanel() {
  const { user } = useAuth()
  const router = useRouter()
  const [section, setSection] = useState<string | null>(null)

  if (!user) return null

  if (section) return <SectionScreen section={section} onBack={() => setSection(null)} />

  return (
    // px-4, matching every other panel against main's own (zero)
    // padding -- see the same fix/note in ProfilePanel.tsx. This file
    // copied that now-corrected -mx-4/px-5 pattern verbatim, so it
    // carried the identical "too wide" bug before ever shipping.
    <div className="bg-[#0f0f0f] min-h-[calc(100vh-56px)] text-white px-4 pt-4 pb-8">
      <p className="text-[22px] font-bold mb-6">Settings</p>

      <SettingsGroup>
        <SettingsRow icon={User} label="Account" onClick={() => setSection('account')} />
        <SettingsRow icon={Bell} label="Notifications" onClick={() => setSection('notifications')} />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow icon={Download} label="Data and privacy" onClick={() => setSection('privacy')} />
        <SettingsRow icon={Flag} label="Raise a concern" onClick={() => setSection('report')} />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow icon={FileText} label="Legal" onClick={() => setSection('legal')} />
      </SettingsGroup>

      <button
        onClick={async () => { await signOut(); router.replace('/auth/login') }}
        className="flex items-center gap-2 text-[14px] font-semibold text-danger-text mt-6"
      >
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </div>
  )
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl divide-y divide-white/[0.06] mb-4 overflow-hidden">{children}</div>
}

function SettingsRow({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition text-left">
      <Icon className="w-[18px] h-[18px] text-[#999] flex-shrink-0" />
      <span className="flex-1 text-[14px] font-medium">{label}</span>
      <ChevronRight className="w-4 h-4 text-[#555] flex-shrink-0" />
    </button>
  )
}

function ScreenShell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-[#0f0f0f] min-h-[calc(100vh-56px)] text-white">
      <div className="sticky top-0 z-10 flex items-center h-14 px-3 bg-[#0f0f0f]/95 backdrop-blur border-b border-white/10">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition -scale-x-100">
          <ChevronRight className="w-5 h-5" />
        </button>
        <p className="text-[15px] font-semibold ml-1">{title}</p>
      </div>
      <div className="px-4 py-5">{children}</div>
    </div>
  )
}

function SectionScreen({ section, onBack }: { section: string; onBack: () => void }) {
  if (section === 'account') return <AccountSection onBack={onBack} />
  if (section === 'notifications') return <NotificationsSection onBack={onBack} />
  if (section === 'privacy') return <PrivacySection onBack={onBack} />
  if (section === 'report') return <ReportSection onBack={onBack} />
  if (section === 'legal') return <LegalSection onBack={onBack} />
  return null
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

function AccountSection({ onBack }: { onBack: () => void }) {
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
    <ScreenShell title="Account" onBack={onBack}>
      {error && <p className="text-[13px] text-danger-text mb-3">{error}</p>}
      {notice && <p className="text-[13px] text-success-text font-semibold mb-3">{notice}</p>}

      <DarkField label="Full name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
      <div className="mb-5"><DarkButton onClick={saveName} disabled={savingName}>{savingName ? 'Saving…' : 'Save name'}</DarkButton></div>

      <div className="mb-5">
        <span className="block text-[13px] font-semibold text-[#999] mb-1.5">Email</span>
        <p className="text-[15px] text-white">{user?.email}</p>
      </div>

      <div className="flex items-center gap-2 mb-1.5">
        <Lock className="w-3.5 h-3.5 text-[#999]" />
        <span className="text-[13px] font-semibold text-[#999]">Change password</span>
      </div>
      <DarkField label="" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 8 characters)" />
      <DarkButton onClick={savePassword} disabled={savingPassword || !newPassword}>{savingPassword ? 'Changing…' : 'Change password'}</DarkButton>
    </ScreenShell>
  )
}

function NotificationsSection({ onBack }: { onBack: () => void }) {
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
    <ScreenShell title="Notifications" onBack={onBack}>
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl divide-y divide-white/[0.06] overflow-hidden mb-4">
        {Object.entries(NOTIFICATION_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[14px] text-white">{label}</span>
            <button
              onClick={() => toggle(key)} disabled={saving}
              className={`w-11 h-6 rounded-full transition relative flex-shrink-0 ${(prefs as any)[key] ? 'bg-brand' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${(prefs as any)[key] ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-[#666]">These preferences are saved now and will govern email notifications once those go live.</p>
    </ScreenShell>
  )
}

function PrivacySection({ onBack }: { onBack: () => void }) {
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
    <ScreenShell title="Data and privacy" onBack={onBack}>
      <p className="text-[13px] text-[#999] mb-4 leading-relaxed">Everything LERN holds about you, and your rights over it under UK GDPR.</p>
      <div className="mb-6"><DarkButton onClick={download} disabled={downloading}>{downloading ? 'Preparing…' : 'Download my data'}</DarkButton></div>

      <div className="pt-5 border-t border-white/10">
        {error && <p className="text-[13px] text-danger-text mb-3">{error}</p>}
        {!confirmingDelete ? (
          <button onClick={() => setConfirmingDelete(true)} className="flex items-center gap-1.5 text-[14px] font-semibold text-danger-text">
            <Trash2 className="w-3.5 h-3.5" /> Delete my account and data
          </button>
        ) : (
          <div>
            <p className="text-[13px] text-danger-text font-semibold mb-3">This permanently deletes your account and everything attached to it. It can't be undone.</p>
            <DarkField label={`Type "${user?.email}" to confirm`} value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={user?.email} />
            <div className="flex gap-2">
              <div className="flex-1"><DarkButton onClick={() => setConfirmingDelete(false)}>Cancel</DarkButton></div>
              <div className="flex-1"><DarkButton danger onClick={doDelete} disabled={deleting || confirmText !== user?.email}>{deleting ? 'Deleting…' : 'Delete'}</DarkButton></div>
            </div>
          </div>
        )}
      </div>
    </ScreenShell>
  )
}

function ReportSection({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
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
    setSent(true); setReason('')
  }

  return (
    <ScreenShell title="Raise a concern" onBack={onBack}>
      <p className="text-[13px] text-[#999] mb-4 leading-relaxed">
        Something wrong with content or a person on LERN? Tell us here — a human reviews every report, never an automated ban.
      </p>
      {sent && <p className="text-[13px] text-success-text font-semibold mb-3">Sent — thank you. Someone will follow up.</p>}
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

function LegalSection({ onBack }: { onBack: () => void }) {
  return (
    <ScreenShell title="Legal" onBack={onBack}>
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl divide-y divide-white/[0.06] overflow-hidden">
        {[
          ['Terms of Service', '/legal/terms'],
          ['Privacy Policy', '/legal/privacy'],
          ['Safeguarding', '/legal/safeguarding'],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition">
            <span className="text-[14px] text-white">{label}</span>
            <ChevronRight className="w-4 h-4 text-[#555]" />
          </Link>
        ))}
      </div>
    </ScreenShell>
  )
}
