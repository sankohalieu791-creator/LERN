'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { updateUserProfile, submitInstructorApplication } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Moon, Lock, Bell, Shield,
  LogOut, X, CheckCircle2, MapPin, Clock, Mail, Phone, Languages, Check, Send,
} from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'
import { LANGUAGES, type Language } from '@/lib/translations'

// ── helpers ───────────────────────────────────────────────────
function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center bg-[#1d9bf0] rounded-full flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ width: size * 0.58, height: size * 0.58 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-6 pb-2 text-[#555] theme-text-2 text-[11px] font-bold uppercase tracking-widest">
      {children}
    </p>
  )
}

const ROLE_OPTIONS: { value: string; label: string; desc: string; color: string }[] = [
  { value: 'mentor',    label: 'Mentor',    desc: 'Guide & advise learners',      color: 'bg-purple-600' },
  { value: 'coach',     label: 'Coach',     desc: 'Train & develop skills',       color: 'bg-orange-500' },
  { value: 'teacher',   label: 'Teacher',   desc: 'Teach structured curriculum',  color: 'bg-green-600'  },
  { value: 'professor', label: 'Professor', desc: 'Academic & research-led',      color: 'bg-blue-600'   },
  { value: 'dr',        label: 'Dr.',       desc: 'Doctorate & expert-led',       color: 'bg-teal-600'   },
]

// ── page ──────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, signOut, refreshUser } = useAuth()
  const router = useRouter()
  const { language, setLanguage, t } = useLanguage()

  const [showLangPicker, setShowLangPicker] = useState(false)
  const [darkMode,   setDarkMode]   = useState(true)
  const [showApply,  setShowApply]  = useState(false)
  const [applying,      setApplying]      = useState(false)
  const [applied,       setApplied]       = useState(false)
  const [applyError,    setApplyError]    = useState('')
  const [testingPush,   setTestingPush]   = useState(false)
  const [testPushMsg,   setTestPushMsg]   = useState('')

  const [applyForm, setApplyForm] = useState({
    role_type:       '',
    name:            '',
    topic:           '',
    bio:             '',
    location:        '',
    experience:      '',
    contact_email:   '',
    contact_phone:   '',
  })

  useEffect(() => {
    if (user) {
      setDarkMode(user.dark_mode ?? true)
      setApplyForm(f => ({ ...f, name: user.username || '' }))
    }
  }, [user])

  useEffect(() => {
    if (showApply) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [showApply])

  const toggleDarkMode = async () => {
    const next = !darkMode
    setDarkMode(next)
    document.documentElement.classList.toggle('light', !next)
    document.documentElement.classList.toggle('dark',   next)
    if (user) await updateUserProfile(user.id, { dark_mode: next })
  }

  const canSubmit =
    applyForm.role_type && applyForm.name.trim() &&
    applyForm.topic.trim() && applyForm.bio.trim() &&
    applyForm.location.trim() && applyForm.experience.trim()

  const handleApply = async () => {
    if (!canSubmit || !user) return
    setApplying(true)
    setApplyError('')
    const { error } = await submitInstructorApplication(user.id, {
      full_name:       applyForm.name,
      topic:           applyForm.topic,
      bio:             applyForm.bio,
      role_type:       applyForm.role_type,
      location:        applyForm.location || undefined,
      experience_years: applyForm.experience ? parseInt(applyForm.experience) : undefined,
      contact_email:   applyForm.contact_email || undefined,
      contact_phone:   applyForm.contact_phone || undefined,
    })
    setApplying(false)
    if (error) {
      setApplyError(error.message || 'Submission failed. Please try again.')
      return
    }
    // Grant instructor access immediately + verified badge
    const { error: profileErr } = await updateUserProfile(user.id, { account_type: 'instructor', verified: true })
    if (profileErr) {
      setApplyError('Application saved but could not activate instructor access. Please sign out and back in.')
      return
    }
    await refreshUser()
    setApplied(true)
  }

  const closeApply = () => {
    setShowApply(false)
    setTimeout(() => { setApplied(false); setApplyError('') }, 300)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const handleTestPush = async () => {
    if (!user) return
    setTestingPush(true)
    setTestPushMsg('')
    try {
      // Re-register subscription in case it wasn't stored yet
      const { registerPushSubscription } = await import('@/lib/push')
      await registerPushSubscription(user.id)
      // Small delay to let subscription save
      await new Promise(r => setTimeout(r, 1000))
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const data = await res.json()
      if (data.ok) {
        setTestPushMsg('Sent! Close the app and check your notifications.')
      } else {
        setTestPushMsg(data.error ?? 'Failed. Make sure you allowed notifications.')
      }
    } catch {
      setTestPushMsg('Error sending test push.')
    } finally {
      setTestingPush(false)
    }
  }

  const initial = user?.username?.[0]?.toUpperCase() ?? 'U'

  return (
    <>
    <div className="fixed inset-0 bg-[#0f0f0f] theme-bg flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* HEADER — always stays at top */}
      <div className="flex-shrink-0 px-4 py-4 flex items-center gap-3 border-b border-[rgba(255,255,255,0.07)] theme-border bg-[#0f0f0f] theme-bg">
        <Link href="/profile/me" className="text-[#888] hover:text-white transition">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-white theme-text-1 font-bold text-lg">{t('settings')}</h1>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      {/* USER ROW */}
      <Link href="/profile/me" className="flex items-center gap-3.5 px-4 py-4 border-b border-[rgba(255,255,255,0.07)] theme-border hover:bg-[#181818] transition">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-lg font-bold overflow-hidden flex-shrink-0">
          {user?.avatar_url
            ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
            : initial}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-white theme-text-1 font-bold text-base leading-tight">{user?.username ?? 'Your Name'}</p>
            {user?.verified && <VerifiedBadge size={16} />}
          </div>
          <p className="text-[#555] theme-text-2 text-xs mt-0.5">
            {t('view_profile')} · <span className="capitalize">{user?.account_type ?? 'student'}</span>
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-[#444]" />
      </Link>

      {/* CREATOR */}
      <SectionLabel>{t('creator')}</SectionLabel>
      <div className="border-t border-[rgba(255,255,255,0.05)] theme-border">
        {user?.account_type === 'instructor' ? (
          <div className="flex items-center gap-3.5 px-4 py-4 border-b border-[rgba(255,255,255,0.05)]">
            <div className="w-9 h-9 rounded-full bg-[#1d9bf0] flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-white theme-text-1 text-sm font-semibold">{t('verified_instructor')}</p>
                {user?.verified && <VerifiedBadge size={15} />}
              </div>
              <p className="text-[#555] theme-text-2 text-xs mt-0.5">{t('verified_instructor_sub')}</p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowApply(true)}
            className="w-full flex items-center gap-3.5 px-4 py-4 border-b border-[rgba(255,255,255,0.05)] hover:bg-[#181818] transition text-left"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white theme-text-1 text-sm font-semibold">{t('apply_to_teach')}</p>
              <p className="text-[#555] theme-text-2 text-xs mt-0.5">{t('apply_to_teach_sub')}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#444] flex-shrink-0" />
          </button>
        )}
      </div>

      {/* APPEARANCE */}
      <SectionLabel>{t('appearance')}</SectionLabel>
      <div className="border-t border-[rgba(255,255,255,0.05)] theme-border">
        <div className="flex items-center gap-3.5 px-4 py-4 border-b border-[rgba(255,255,255,0.05)]">
          <div className="w-9 h-9 rounded-full bg-[#1e1e1e] flex items-center justify-center flex-shrink-0">
            <Moon className="w-4 h-4 text-[#888]" />
          </div>
          <div className="flex-1">
            <p className="text-white theme-text-1 text-sm font-semibold">{t('dark_mode')}</p>
            <p className="text-[#555] theme-text-2 text-xs mt-0.5">{t('dark_mode_sub')}</p>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${darkMode ? 'bg-[#FF6B2B]' : 'bg-[#333]'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <button
          onClick={() => setShowLangPicker(true)}
          className="w-full flex items-center gap-3.5 px-4 py-4 border-b border-[rgba(255,255,255,0.05)] hover:bg-[#181818] transition text-left"
        >
          <div className="w-9 h-9 rounded-full bg-[#1e1e1e] flex items-center justify-center flex-shrink-0">
            <Languages className="w-4 h-4 text-[#888]" />
          </div>
          <div className="flex-1">
            <p className="text-white theme-text-1 text-sm font-semibold">{t('language')}</p>
            <p className="text-[#555] theme-text-2 text-xs mt-0.5">
              {LANGUAGES.find(l => l.code === language)?.flag} {LANGUAGES.find(l => l.code === language)?.name}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#444] flex-shrink-0" />
        </button>
      </div>

      {/* ACCOUNT */}
      <SectionLabel>{t('account')}</SectionLabel>
      <div className="border-t border-[rgba(255,255,255,0.05)] theme-border">
        <Link href="/settings/account" className="w-full flex items-center gap-3.5 px-4 py-4 border-b border-[rgba(255,255,255,0.05)] hover:bg-[#181818] transition">
          <div className="w-9 h-9 rounded-full bg-[#1e1e1e] flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4 text-[#888]" />
          </div>
          <div className="flex-1">
            <p className="text-white theme-text-1 text-sm font-semibold">{t('account_security')}</p>
            <p className="text-[#555] theme-text-2 text-xs mt-0.5">{t('account_security_sub')}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#444] flex-shrink-0" />
        </Link>
        <Link href="/settings/notifications" className="w-full flex items-center gap-3.5 px-4 py-4 border-b border-[rgba(255,255,255,0.05)] hover:bg-[#181818] transition">
          <div className="w-9 h-9 rounded-full bg-[#1e1e1e] flex items-center justify-center flex-shrink-0">
            <Bell className="w-4 h-4 text-[#888]" />
          </div>
          <div className="flex-1">
            <p className="text-white theme-text-1 text-sm font-semibold">{t('notifications')}</p>
            <p className="text-[#555] theme-text-2 text-xs mt-0.5">{t('notifications_sub')}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#444] flex-shrink-0" />
        </Link>
        <div className="px-4 py-4 border-b border-[rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-full bg-[#1e1e1e] flex items-center justify-center flex-shrink-0">
              <Send className="w-4 h-4 text-[#888]" />
            </div>
            <div className="flex-1">
              <p className="text-white theme-text-1 text-sm font-semibold">Test Push Notification</p>
              <p className="text-[#555] theme-text-2 text-xs mt-0.5">Send a test to verify lock-screen notifications work</p>
            </div>
            <button
              onClick={handleTestPush}
              disabled={testingPush}
              className="bg-[#FF6B2B] text-white text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-40"
            >
              {testingPush ? '...' : 'Test'}
            </button>
          </div>
          {testPushMsg && (
            <p className={`mt-2 ml-[52px] text-xs ${testPushMsg.startsWith('Sent') ? 'text-green-400' : 'text-red-400'}`}>
              {testPushMsg}
            </p>
          )}
        </div>
      </div>

      {/* LEGAL */}
      <SectionLabel>{t('legal')}</SectionLabel>
      <div className="border-t border-[rgba(255,255,255,0.05)] theme-border">
        <Link href="/settings/privacy" className="w-full flex items-center gap-3.5 px-4 py-4 border-b border-[rgba(255,255,255,0.05)] hover:bg-[#181818] transition">
          <div className="w-9 h-9 rounded-full bg-[#1e1e1e] flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-[#888]" />
          </div>
          <div className="flex-1">
            <p className="text-white theme-text-1 text-sm font-semibold">{t('privacy')}</p>
            <p className="text-[#555] theme-text-2 text-xs mt-0.5">{t('privacy_sub')}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#444] flex-shrink-0" />
        </Link>
      </div>

      {/* SIGN OUT */}
      <div className="mt-8 border-t border-[rgba(255,255,255,0.07)]">
        <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-4 text-red-400 hover:text-red-300 transition">
          <LogOut className="w-5 h-5" />
          <span className="font-semibold">{t('sign_out')}</span>
        </button>
      </div>

      </div>{/* end scrollable content */}
    </div>

    {/* ── LANGUAGE PICKER ──────────────────────────────────── */}
    {showLangPicker && (
      <div className="fixed inset-0 z-[60] flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowLangPicker(false)} />
        <div className="relative bg-[#141414] rounded-t-3xl flex flex-col" style={{ maxHeight: '80vh' }}>
          <div className="flex justify-center pt-3 flex-shrink-0">
            <div className="w-10 h-1 bg-[#333] rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 pt-3 pb-4 flex-shrink-0 border-b border-[rgba(255,255,255,0.07)]">
            <h2 className="text-white text-lg font-bold">{t('language')}</h2>
            <button onClick={() => setShowLangPicker(false)} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain py-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => { setLanguage(lang.code as Language); setShowLangPicker(false) }}
                className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-[#1e1e1e] transition text-left border-b border-[rgba(255,255,255,0.04)]"
              >
                <span className="text-2xl">{lang.flag}</span>
                <span className="text-white text-sm font-semibold flex-1">{lang.name}</span>
                {language === lang.code && (
                  <Check className="w-4 h-4 text-[#FF6B2B]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* ── APPLY TO TEACH MODAL ─────────────────────────────── */}
      {showApply && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!applied ? closeApply : undefined} />
          <div className="relative bg-[#141414] rounded-t-3xl flex flex-col" style={{ minHeight: '80vh', maxHeight: '94vh' }}>

            {/* Handle */}
            <div className="flex justify-center pt-3 flex-shrink-0">
              <div className="w-10 h-1 bg-[#333] rounded-full" />
            </div>
            {/* Close */}
            <div className="flex justify-end px-4 pt-3 pb-1 flex-shrink-0">
              <button onClick={closeApply} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {applied ? (
                /* SUCCESS */
                <div className="px-6 pb-12 text-center pt-4">
                  <div className="w-16 h-16 bg-[#1d9bf0] rounded-full flex items-center justify-center mx-auto mb-5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h2 className="text-white text-xl font-bold mb-2">Application submitted!</h2>
                  <p className="text-[#555] text-sm leading-relaxed">
                    Your profile will appear in Discover right away. Once reviewed you'll receive your verified instructor badge.
                  </p>
                  <button onClick={closeApply} className="mt-7 w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl">
                    Done
                  </button>
                </div>
              ) : (
                /* FORM */
                <div className="px-5 pb-6 pt-1">
                  <h2 className="text-white text-2xl font-bold mb-1">Apply to teach</h2>
                  <p className="text-[#555] text-sm mb-5 leading-relaxed">
                    Every instructor on LERNX is verified before they can publish a course or go live.
                  </p>

                  {applyError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                      <p className="text-red-400 text-sm">{applyError}</p>
                    </div>
                  )}

                  {/* ROLE TYPE */}
                  <div className="mb-5">
                    <p className={labelCls}>I am a…</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ROLE_OPTIONS.map(r => (
                        <button
                          key={r.value}
                          onClick={() => setApplyForm(f => ({ ...f, role_type: r.value }))}
                          className={`flex flex-col items-start p-3.5 rounded-2xl border transition ${
                            applyForm.role_type === r.value
                              ? 'border-[#FF6B2B] bg-[#FF6B2B]/10'
                              : 'border-[rgba(255,255,255,0.08)] bg-[#1e1e1e] hover:border-[rgba(255,255,255,0.2)]'
                          }`}
                        >
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5 text-white ${r.color}`}>
                            {r.label.toUpperCase()}
                          </span>
                          <span className="text-white text-sm font-semibold">{r.label}</span>
                          <span className="text-[#555] text-xs mt-0.5">{r.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CORE FIELDS */}
                  <div className="space-y-4">
                    <ApplyField label="Full legal name">
                      <input value={applyForm.name} onChange={e => setApplyForm(f => ({ ...f, name: e.target.value }))} className={applyInputCls} />
                    </ApplyField>

                    <ApplyField label="Topic / Specialty">
                      <input value={applyForm.topic} onChange={e => setApplyForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. Pro Football — UEFA B Licensed" className={applyInputCls} />
                    </ApplyField>

                    <ApplyField label="Short bio">
                      <textarea value={applyForm.bio} onChange={e => setApplyForm(f => ({ ...f, bio: e.target.value }))} placeholder="Why should learners trust you?" rows={3} className={`${applyInputCls} resize-none`} />
                    </ApplyField>

                    <div className="flex gap-3">
                      <ApplyField label="Location" className="flex-1">
                        <div className="relative">
                          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                          <input value={applyForm.location} onChange={e => setApplyForm(f => ({ ...f, location: e.target.value }))} placeholder="London, UK" className={`${applyInputCls} pl-9`} />
                        </div>
                      </ApplyField>
                      <ApplyField label="Experience (yrs)" className="w-28">
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                          <input value={applyForm.experience} onChange={e => setApplyForm(f => ({ ...f, experience: e.target.value }))} placeholder="15" type="number" className={`${applyInputCls} pl-9`} />
                        </div>
                      </ApplyField>
                    </div>
                  </div>

                  {/* OPTIONAL CONTACT */}
                  <div className="mt-5">
                    <p className={`${labelCls} mb-3`}>Contact details <span className="text-[#444] normal-case font-normal">(optional — shown to followers)</span></p>
                    <div className="space-y-3">
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                        <input value={applyForm.contact_email} onChange={e => setApplyForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="your@email.com" type="email" className={`${applyInputCls} pl-9`} />
                      </div>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                        <input value={applyForm.contact_phone} onChange={e => setApplyForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="+44 20 7946 0312" type="tel" className={`${applyInputCls} pl-9`} />
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Sticky submit footer — always visible */}
            {!applied && (
              <div className="flex-shrink-0 px-5 py-4 border-t border-[rgba(255,255,255,0.07)] bg-[#141414]"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
                <button
                  onClick={handleApply}
                  disabled={applying || !canSubmit}
                  className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 active:scale-[0.98] transition"
                >
                  {applying ? 'Submitting…' : 'Submit application'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const labelCls    = 'text-[#555] text-[10px] font-bold uppercase tracking-wider'
const applyInputCls = 'w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition'

function ApplyField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className={`${labelCls} mb-2`}>{label}</p>
      {children}
    </div>
  )
}
