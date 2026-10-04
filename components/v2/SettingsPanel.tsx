'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useResolvedTheme } from '@/context/ThemeProvider'
import {
  updateUserProfile, changePassword, setThemePreference, setNotificationPrefs,
  exportMyData, deleteMyAccount, submitReport, signOut,
  getOrgStaff, updateOrganisationProfile, supabase,
  requestEmailChange, sendPasswordResetEmail, signOutEverywhere,
  getBlockedUsers, unblockUser, setCookieConsent, uploadOrgLogo,
  uploadAvatar, removeAvatar, disableTwoStep,
} from '@/lib/supabase'
import TwoStepSetup from '@/components/v2/TwoStepSetup'
import { useAvatarUrl } from '@/lib/useAvatarUrl'
import { TextField, PrimaryButton, SecondaryButton, ErrorBanner } from '@/components/v2/Field'
import {
  X, ChevronLeft, Sun, Moon, Monitor, ShieldCheck, Users2, Ticket,
  Mail, UserX, ChevronRight, Camera, BadgeCheck, LogOut,
  Lock, Download, User, Bell, AlertTriangle, KeyRound, Flag, Cookie, Trash2,
  Paintbrush, Info, CreditCard, HelpCircle, FileText, ClipboardList, Smartphone, MonitorX,
} from 'lucide-react'
import JoinCodesPanel from '@/components/v2/JoinCodesPanel'
import BillingPanel from '@/components/v2/BillingPanel'
import EmployerSubscriptionPanel from '@/components/v2/EmployerSubscriptionPanel'
import { showOnboardingChecklist } from '@/components/v2/OnboardingChecklist'
import ScrollTrack from '@/components/v2/ScrollTrack'

// Rebuilt as a modal dialog with left-tab navigation, 2 Oct 2026 --
// same interaction model as the "Create brief" modal (a createPortal
// overlay, not a page route) and the same left-tab-plus-content-pane
// shape as Claude's own Settings dialog: click a tab, the content pane
// to its right swaps, no URL change, no full-page navigation.
// Previously this was a full /settings PAGE with a single flat `screen`
// state -- every sub-screen's "Back" returned to one hardcoded root
// regardless of which group it came from. Now `activeTab` (which tab
// is selected) and `subScreen` (a sub-form opened from within a tab,
// e.g. Change password) are separate state: opening a sub-screen never
// touches activeTab, so its own Back always lands back on the correct
// tab, not a flat list.
const NOTIFICATION_LABELS: Record<string, string> = {
  work_submitted: 'Work submitted for review',
  work_verified: 'Work verified',
  employer_interest: 'Employer interest',
  reports: 'New reports',
}

export type TabKey = 'profile' | 'security' | 'billing' | 'notifications' | 'privacy' | 'appearance' | 'help'
type Screen = null | 'email' | 'password' | 'photo' | 'rename' | 'organisation' | 'blocked' | 'report' | 'delete' | 'consent'

const SCREEN_TITLE: Record<Exclude<Screen, null>, string> = {
  email: 'Change email', password: 'Change password', photo: 'Profile photo', rename: 'Full name',
  organisation: 'Organisation', blocked: 'Blocked accounts', report: 'Report a problem',
  delete: 'Delete my account', consent: 'Consent',
}

// Opens the modal from anywhere outside OrgShell's own tree (e.g. a
// "Turn it on in Settings" CTA deep inside Bootcamp Evidence) without
// prop-drilling a setter down through every intermediate component --
// same event-dispatch pattern as showOnboardingChecklist() below.
export function openSettings(tab?: TabKey) {
  window.dispatchEvent(new CustomEvent('lern:open-settings', { detail: { tab } }))
}

export default function SettingsPanel({ onClose, initialTab }: { onClose: () => void; initialTab?: TabKey }) {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const theme = useResolvedTheme()
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab || 'profile')
  const [screen, setScreen] = useState<Screen>(null)
  const [org, setOrg] = useState<any>(null)
  const [busyField, setBusyField] = useState<string | null>(null)
  const [showTwoStepSetup, setShowTwoStepSetup] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const logoUrl = useAvatarUrl(org?.logo_path)
  const avatarUrl = useAvatarUrl(user?.avatar_path)
  const isOrgAdmin = user?.role === 'institution_staff' || user?.role === 'provider_staff'

  useEffect(() => {
    if (user?.organisation_id) {
      supabase.from('organisations').select('*').eq('id', user.organisation_id).single().then(({ data }) => setOrg(data))
    }
  }, [user?.organisation_id])

  // Esc closes the whole dialog (sub-screen first, if one's open) --
  // same expectation as any desktop settings window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (screen) setScreen(null)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [screen, onClose])

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
    alert(error ? `Couldn't send the reset link — ${error.message}` : `A password reset link has been sent to ${user.email}.`)
  }

  const toggleTwoStep = async () => {
    if (!user.two_step_enabled) { setShowTwoStepSetup(true); return }
    const code = prompt('Enter the current 6-digit code from your authenticator app to turn this off.')
    if (!code) return
    setBusyField('two_step')
    const { error } = await disableTwoStep(code.trim())
    setBusyField(null)
    if (error) { alert('That code didn’t match — two-step verification is still on.'); return }
    await refreshUser()
  }

  const requestSignOutEverywhere = async () => {
    if (!confirm('Sign out of every device you’re signed in on?')) return
    const { error } = await signOutEverywhere()
    if (error) { alert(`Couldn't sign out everywhere — ${error.message}`); return }
    router.replace('/auth/login')
  }

  const toggleAnalytics = async () => {
    setBusyField('cookies')
    await setCookieConsent(user.id, !(user.cookie_consent?.analytics ?? false))
    await refreshUser()
    setBusyField(null)
  }

  const roleLabel = user.role === 'employer' ? 'Employer' : user.role === 'institution_staff' ? 'Institution staff' : 'Provider staff'

  const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Security', icon: ShieldCheck },
    { key: 'billing', label: 'Billing', icon: CreditCard },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'privacy', label: 'Privacy & data', icon: Lock },
    { key: 'appearance', label: 'Appearance', icon: Paintbrush },
    { key: 'help', label: 'Help & legal', icon: HelpCircle },
  ]

  const reloadOrg = () => { if (user.organisation_id) supabase.from('organisations').select('*').eq('id', user.organisation_id).single().then(({ data }) => setOrg(data)) }

  const renderScreen = () => {
    switch (screen) {
      case 'email': return <ChangeEmailScreen currentEmail={user.email} onBack={() => setScreen(null)} />
      case 'password': return <ChangePasswordScreen onBack={() => setScreen(null)} />
      case 'photo': return <PhotoScreen onBack={() => setScreen(null)} />
      case 'rename': return <RenameScreen onBack={() => setScreen(null)} />
      case 'organisation': return <OrganisationScreen org={org} onBack={() => setScreen(null)} onChanged={() => { setOrg(null); reloadOrg() }} />
      case 'blocked': return <BlockedAccountsScreen userId={user.id} onBack={() => setScreen(null)} />
      case 'report': return <ReportScreen userId={user.id} organisationId={user.organisation_id || null} onBack={() => setScreen(null)} />
      case 'delete': return <DeleteAccountScreen email={user.email} onBack={() => setScreen(null)} />
      case 'consent': return <ConsentScreen consentedAt={user.consented_at} onBack={() => setScreen(null)} onDelete={() => setScreen('delete')} />
      default: return null
    }
  }

  // Takes the tab explicitly, not a closure over activeTab -- the phone
  // flat list below calls this once per tab to build one continuous
  // list, which the tab-switching desktop view couldn't need.
  const renderTabContent = (tab: TabKey) => {
    switch (tab) {
      case 'profile':
        return (
          <>
            <div className="flex items-center gap-4 bg-gradient-to-br from-accent-bg to-surface border border-edge rounded-2xl px-5 py-5 mb-6">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-surface shadow-sm" />
              ) : (
                <span className="w-16 h-16 rounded-full bg-brand text-white font-bold text-[22px] flex items-center justify-center flex-shrink-0 border-2 border-surface shadow-sm">
                  {user.full_name?.[0]?.toUpperCase() || 'U'}
                </span>
              )}
              <div className="min-w-0">
                <p className="font-bold text-ink text-[17px] truncate">{user.full_name}</p>
                <p className="text-[13px] text-ink-secondary truncate">{user.email}</p>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand bg-surface px-2 py-0.5 rounded-full mt-1.5">
                  {isOrgAdmin && org?.name ? `${roleLabel} · ${org.name}` : roleLabel}
                </span>
              </div>
            </div>

            <Group>
              {isOrgAdmin && (
                <Row
                  icon={Users2} label={org?.name || 'Your organisation'} onClick={() => setScreen('organisation')}
                  right={
                    <span className="flex items-center gap-2">
                      {org?.verified && <BadgeCheck className="w-4 h-4 flex-shrink-0" style={{ color: '#4a9de0' }} />}
                      {logoUrl ? <img src={logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" /> : <span className="w-8 h-8 rounded-lg bg-accent-bg text-brand font-bold text-[12px] flex items-center justify-center">{org?.name?.[0]?.toUpperCase() || 'O'}</span>}
                    </span>
                  }
                />
              )}
              <Row
                icon={Camera} label="Profile photo" onClick={() => setScreen('photo')}
                right={avatarUrl ? <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" /> : <span className="w-8 h-8 rounded-full bg-accent-bg text-brand font-bold text-[12px] flex items-center justify-center">{user.full_name?.[0]?.toUpperCase() || 'U'}</span>}
              />
              <Row icon={User} label="Full name" value={user.full_name} onClick={() => setScreen('rename')} />
              <Row icon={Mail} label="Email" value={user.email} onClick={() => setScreen('email')} />
              <Row icon={KeyRound} label="Change password" onClick={() => setScreen('password')} />
              {user.role === 'employer' && (
                <Row
                  icon={BadgeCheck} label="Employer status" noChevron
                  value={user.employer_verified ? undefined : 'Not yet verified'}
                  right={user.employer_verified ? <span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: '#4a9de0' }}><BadgeCheck className="w-3.5 h-3.5" /> Verified</span> : undefined}
                />
              )}
            </Group>
          </>
        )

      case 'security':
        return (
          <Group>
            <Row icon={Mail} label="Reset password by email" onClick={requestReset} busy={busyField === 'reset'} />
            <ToggleRow icon={Smartphone} label="Two-step verification" value={!!user.two_step_enabled} busy={busyField === 'two_step'} onToggle={toggleTwoStep} />
            <Row icon={MonitorX} label="Sign out of all devices" onClick={requestSignOutEverywhere} danger />
            <Row icon={UserX} label="Blocked accounts" onClick={() => setScreen('blocked')} />
          </Group>
        )

      case 'billing':
        return user.role === 'employer' ? <EmployerSubscriptionPanel /> : <BillingPanel />

      case 'notifications':
        return (
          <>
            <Group>
              <ToggleRow icon={Bell} label="Push notifications" value={prefs.push_enabled !== false} busy={busyField === 'push_enabled'} onToggle={v => saveNotif('push_enabled', v)} />
              <ToggleRow icon={Mail} label="Email notifications" value={prefs.email_enabled !== false} busy={busyField === 'email_enabled'} onToggle={v => saveNotif('email_enabled', v)} />
            </Group>
            <Group>
              {Object.entries(NOTIFICATION_LABELS).map(([key, label]) => (
                <ToggleRow key={key} label={label} value={prefs[key] !== false} busy={busyField === key} onToggle={() => saveNotif(key)} />
              ))}
            </Group>
          </>
        )

      case 'privacy':
        return (
          <>
            <Group>
              <Row icon={Download} label="Download my data" onClick={async () => {
                const data = await exportMyData(user.id)
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `lern-my-data-${new Date().toISOString().split('T')[0]}.json`; a.click()
                URL.revokeObjectURL(url)
              }} />
              <Row icon={FileText} label="Consent" value="View" onClick={() => setScreen('consent')} />
              <ToggleRow icon={Cookie} label="Analytics cookies" hint="Essential cookies are always on" value={!!user.cookie_consent?.analytics} busy={busyField === 'cookies'} onToggle={toggleAnalytics} />
              <Row icon={Trash2} label="Delete my account and data" danger onClick={() => setScreen('delete')} />
            </Group>
            <Group title="Raise a concern" icon={AlertTriangle}>
              <Row icon={Flag} label="Report a problem or something that worries you" onClick={() => setScreen('report')} />
            </Group>
          </>
        )

      case 'appearance':
        return (
          <Group>
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
        )

      case 'help':
        return (
          <>
            {(isOrgAdmin || user.role === 'employer') && (
              <Group>
                <Row icon={ClipboardList} label="Show setup checklist" onClick={showOnboardingChecklist} />
              </Group>
            )}
            <Group title="About and legal" icon={Info}>
              <LinkRow icon={FileText} label="Data Protection" href="/legal/privacy" />
              <LinkRow icon={Cookie} label="Cookie Policy" href="/legal/cookies" />
              <LinkRow icon={FileText} label="Terms of Service" href="/legal/terms" />
              <LinkRow icon={ShieldCheck} label="Public safeguarding summary" href="/legal/safeguarding" />
              <Row icon={Info} label="App version" value="1.0" noChevron />
              <a href="mailto:alieu@joinirl.co.uk" className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-muted transition">
                <span className="flex items-center gap-3 text-[14px] text-ink"><Mail className="w-4 h-4 text-ink-tertiary flex-shrink-0" /> Contact and support</span>
                <span className="text-[13px] text-ink-secondary">alieu@joinirl.co.uk</span>
              </a>
            </Group>
          </>
        )
    }
  }

  const renderTab = () => renderTabContent(activeTab)

  // Phone gets one continuous list, grouped by section -- same shape as
  // the student app's own settings page ("one scrolling screen of
  // grouped sections", not a drill-down menu). The laptop's left-tab
  // nav makes sense once there's room for it beside the content; on a
  // phone it was a second, narrower version of the same tab switcher
  // the horizontal scroller already was, just one more tap before
  // reaching anything. Sub-screens (Change password, Blocked accounts,
  // etc.) still drill down the same way either way -- that part was
  // never the complaint.
  const renderAllTabsFlat = () => (
    <>
      {TABS.map(t => (
        <div key={t.key} className="mb-6 last:mb-0">
          <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink-tertiary uppercase tracking-wide mb-2.5">
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </p>
          {renderTabContent(t.key)}
        </div>
      ))}
    </>
  )

  return createPortal((
    <div data-theme={theme} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-8">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl h-[640px] max-h-[88dvh] flex overflow-hidden">
        {/* ── Left tab nav — hidden on phone widths in favour of a top
            scroller, same breakpoint convention the rest of the app
            uses for sidebar vs. drawer. ── */}
        <div className="hidden sm:flex w-[200px] flex-shrink-0 border-r border-edge-subtle bg-surface-subtle flex-col py-4">
          <p className="px-4 pb-3 font-bold text-ink text-[15px]">Settings</p>
          <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
            {TABS.map(t => (
              <button
                key={t.key} onClick={() => { setActiveTab(t.key); setScreen(null) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold transition ${
                  activeTab === t.key && !screen ? 'bg-accent-bg text-brand' : 'text-ink-secondary hover:bg-surface-muted'
                }`}
              >
                <t.icon className="w-4 h-4 flex-shrink-0" /> {t.label}
              </button>
            ))}
          </nav>
          <button onClick={async () => { await signOut(); router.replace('/auth/login') }} className="flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-semibold text-ink-tertiary hover:text-danger-text transition">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-edge-subtle flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {screen && (
                <button onClick={() => setScreen(null)} aria-label="Back" className="w-7 h-7 -ml-1 flex items-center justify-center rounded-full hover:bg-surface-muted text-ink-secondary transition flex-shrink-0">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <p className="font-bold text-ink text-[16px] truncate">
                {screen ? SCREEN_TITLE[screen] : (
                  <>
                    <span className="sm:hidden">Settings</span>
                    <span className="hidden sm:inline">{TABS.find(t => t.key === activeTab)?.label}</span>
                  </>
                )}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-muted text-ink-secondary transition flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative flex-1 min-h-0">
            <div ref={contentRef} className="h-full overflow-y-auto px-5 sm:px-6 py-5">
              {screen ? (
                <ScreenCard>{renderScreen()}</ScreenCard>
              ) : (
                <>
                  {/* Both branches mount (CSS display, not conditional
                      render) -- same always-both-present, visibility-
                      toggled pattern as the sidebar/drawer nav elsewhere
                      in this app. Billing's own panel re-fetches once per
                      mount either way, so this costs one duplicate read,
                      not a layout thrash. */}
                  <div className="sm:hidden">{renderAllTabsFlat()}</div>
                  <div className="hidden sm:block">{renderTab()}</div>
                </>
              )}
            </div>
            <ScrollTrack containerRef={contentRef} />
          </div>
        </div>
      </div>

      {showTwoStepSetup && (
        <TwoStepSetup
          onClose={() => setShowTwoStepSetup(false)}
          onEnabled={async () => { setShowTwoStepSetup(false); await refreshUser() }}
        />
      )}
    </div>
  ), document.body)
}

// ── Shared row/group primitives ─────────────────────────────────────
function Group({ title, icon: Icon, children }: { title?: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      {title && (
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2 px-1">
          {Icon && <Icon className="w-3.5 h-3.5" />} {title}
        </p>
      )}
      <div className="bg-surface border border-edge rounded-2xl divide-y divide-edge-subtle overflow-hidden shadow-sm">
        {children}
      </div>
    </div>
  )
}

function Row({ icon: Icon, label, value, onClick, right, noChevron, noChevronValue, danger, busy }: {
  icon?: React.ComponentType<{ className?: string }>; label: string; value?: string; onClick?: () => void; right?: React.ReactNode
  noChevron?: boolean; noChevronValue?: boolean; danger?: boolean; busy?: boolean
}) {
  const content = (
    <>
      <span className="flex items-center gap-3 min-w-0">
        {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${danger ? 'text-danger-text' : 'text-ink-tertiary'}`} />}
        <span className={`text-[14px] truncate ${danger ? 'text-danger-text' : 'text-ink'}`}>{busy ? 'Working…' : label}</span>
      </span>
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

function ToggleRow({ icon: Icon, label, hint, value, onToggle, busy }: { icon?: React.ComponentType<{ className?: string }>; label: string; hint?: string; value: boolean; onToggle: (v: boolean) => void; busy?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <Icon className="w-4 h-4 flex-shrink-0 text-ink-tertiary" />}
        <div className="min-w-0">
          <p className="text-[14px] text-ink">{label}</p>
          {hint && <p className="text-[12px] text-ink-tertiary mt-0.5">{hint}</p>}
        </div>
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

function LinkRow({ icon: Icon, label, href }: { icon?: React.ComponentType<{ className?: string }>; label: string; href: string }) {
  return (
    <Link href={href} target="_blank" className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-muted transition">
      <span className="flex items-center gap-3 text-[14px] text-ink">{Icon && <Icon className="w-4 h-4 text-ink-tertiary flex-shrink-0" />} {label}</span>
      <ChevronRight className="w-4 h-4 text-ink-tertiary" />
    </Link>
  )
}

// ── Sub-screens — title/back are now handled by the modal's own
// header (see SCREEN_TITLE + the back chevron above), so this is just
// the bordered content card, not a full header of its own. ──────────
function ScreenCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-surface border border-edge rounded-2xl p-6">
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
  const avatarUrl = useAvatarUrl(user?.avatar_path)

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
    <>
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
    </>
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
    <>
      <ErrorBanner message={error} />
      <TextField label="Full name" value={name} onChange={setName} placeholder="Your name" />
      <PrimaryButton onClick={save} loading={saving} disabled={!name.trim()}>Save</PrimaryButton>
    </>
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

  return done ? (
    <p className="text-[14px] text-success-text font-semibold">Password changed.</p>
  ) : (
    <>
      <ErrorBanner message={error} />
      <TextField label="New password" type="password" value={newPassword} onChange={setNewPassword} placeholder="At least 8 characters" />
      <PrimaryButton onClick={submit} loading={saving} disabled={!newPassword}>Change password</PrimaryButton>
    </>
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
    <>
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
    </>
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

  const logoUrl = useAvatarUrl(org?.logo_path)

  return (
    <>
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
    </>
  )
}

function BlockedAccountsScreen({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => { setLoading(true); getBlockedUsers(userId).then(({ data }) => { setRows(data || []); setLoading(false) }) }
  useEffect(load, [userId])

  return loading ? (
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
    <>
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
    </>
  )
}

function ConsentScreen({ consentedAt, onBack, onDelete }: { consentedAt?: string; onBack: () => void; onDelete: () => void }) {
  return (
    <>
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
    </>
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
    <>
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
    </>
  )
}
