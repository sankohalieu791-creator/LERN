'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { updateUserProfile } from '@/lib/supabase'
import { ChevronLeft, Bell, Mail, BookOpen, Volume2, VolumeX } from 'lucide-react'
import Link from 'next/link'

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
        on ? 'bg-[#FF6B2B]' : 'bg-[#333]'
      }`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          on ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function NotifRow({
  icon, label, description, on, onToggle,
}: {
  icon: React.ReactNode
  label: string
  description: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-4 border-b border-[rgba(255,255,255,0.05)] theme-border">
      <div className="w-9 h-9 rounded-full bg-[#1e1e1e] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-white theme-text-1 text-sm font-semibold">{label}</p>
        <p className="text-[#555] theme-text-2 text-xs mt-0.5">{description}</p>
      </div>
      <Toggle on={on} onToggle={onToggle} />
    </div>
  )
}

type NotifKey = 'notif_push_enabled' | 'notif_email_enabled' | 'notif_course_reminders'

export default function NotificationsPage() {
  const { user, refreshUser } = useAuth()
  const [saving, setSaving] = useState(false)

  const [prefs, setPrefs] = useState({
    notif_push_enabled:    true,
    notif_email_enabled:   true,
    notif_course_reminders: true,
  })

  useEffect(() => {
    if (user) {
      setPrefs({
        notif_push_enabled:    user.notif_push_enabled    ?? true,
        notif_email_enabled:   user.notif_email_enabled   ?? true,
        notif_course_reminders: user.notif_course_reminders ?? true,
      })
    }
  }, [user])

  const toggle = async (key: NotifKey) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    if (!user) return
    setSaving(true)
    await updateUserProfile(user.id, { [key]: next[key] })
    await refreshUser()
    setSaving(false)
  }

  const allSilent = !prefs.notif_push_enabled && !prefs.notif_email_enabled && !prefs.notif_course_reminders

  const silenceAll = async () => {
    const next = { notif_push_enabled: false, notif_email_enabled: false, notif_course_reminders: false }
    setPrefs(next)
    if (!user) return
    setSaving(true)
    await updateUserProfile(user.id, next)
    await refreshUser()
    setSaving(false)
  }

  const enableAll = async () => {
    const next = { notif_push_enabled: true, notif_email_enabled: true, notif_course_reminders: true }
    setPrefs(next)
    if (!user) return
    setSaving(true)
    await updateUserProfile(user.id, next)
    await refreshUser()
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] theme-bg pb-24">

      {/* HEADER */}
      <div className="px-4 py-4 flex items-center gap-3 border-b border-[rgba(255,255,255,0.07)] theme-border sticky top-0 bg-[#0f0f0f] theme-bg z-10">
        <Link href="/settings" className="text-[#888] hover:text-white transition">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-white theme-text-1 font-bold text-lg">Notifications</h1>
        {saving && (
          <div className="ml-auto w-4 h-4 rounded-full border-2 border-[#FF6B2B] border-t-transparent animate-spin" />
        )}
      </div>

      {/* SILENCE ALL */}
      <div className="px-4 mt-6 mb-2 flex gap-2">
        <button
          onClick={allSilent ? enableAll : silenceAll}
          className="flex items-center gap-2 bg-[#1a1a1a] theme-card border border-[rgba(255,255,255,0.08)] theme-border rounded-xl px-4 py-2.5 text-sm font-semibold text-white theme-text-1 hover:bg-[#222] transition"
        >
          {allSilent
            ? <><Volume2 className="w-4 h-4 text-[#FF6B2B]" />Enable all</>
            : <><VolumeX className="w-4 h-4 text-[#888]" />Silence all</>
          }
        </button>
      </div>

      {/* TOGGLES */}
      <div className="mt-4 border-t border-[rgba(255,255,255,0.05)] theme-border">
        <NotifRow
          icon={<Bell className="w-4 h-4 text-[#888]" />}
          label="Push notifications"
          description="Likes, comments, new followers"
          on={prefs.notif_push_enabled}
          onToggle={() => toggle('notif_push_enabled')}
        />
        <NotifRow
          icon={<Mail className="w-4 h-4 text-[#888]" />}
          label="Email notifications"
          description="Activity summaries and announcements"
          on={prefs.notif_email_enabled}
          onToggle={() => toggle('notif_email_enabled')}
        />
        <NotifRow
          icon={<BookOpen className="w-4 h-4 text-[#888]" />}
          label="Course reminders"
          description="Upcoming sessions and deadlines"
          on={prefs.notif_course_reminders}
          onToggle={() => toggle('notif_course_reminders')}
        />
      </div>

      {/* INFO */}
      <div className="mx-4 mt-6 bg-[#1a1a1a] theme-card border border-[rgba(255,255,255,0.06)] theme-border rounded-2xl p-4">
        <p className="text-[#555] theme-text-2 text-xs leading-relaxed">
          Push notifications require your browser or device to allow them. Email notifications are sent to{' '}
          <span className="text-white theme-text-1">{user?.email}</span>.
        </p>
      </div>
    </div>
  )
}
