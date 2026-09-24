'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useResolvedTheme } from '@/context/ThemeProvider'
import { markOnboardingSeen, getOrgOnboardingProgress, getEmployerOnboardingProgress } from '@/lib/supabase'
import { checklistItemsFor, CHECKLIST_TITLE, type ChecklistRole } from '@/lib/onboardingChecklist'
import { Check, ChevronDown, ChevronUp, X, PartyPopper } from 'lucide-react'

// Stripe-style setup checklist, 24 Sep 2026 -- replaces the click-
// through OnboardingTour. Each item checks itself off from real data
// (get_org_onboarding_progress / get_employer_onboarding_progress), not
// from clicking "next" on a slide, and the widget stays around (as a
// small floating card, dismissible, collapsible) until the org has
// actually done the four things, rather than a one-time modal a new
// account clicks through once and never revisits. Refetches on every
// route change since the actions it's tracking happen on other pages.
export default function OnboardingChecklist({ role }: { role: ChecklistRole }) {
  const { user, refreshUser } = useAuth()
  const theme = useResolvedTheme()
  const pathname = usePathname()
  const [progress, setProgress] = useState<Record<string, boolean> | null>(null)
  const [visible, setVisible] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!user) return
    setVisible(!user.onboarding_completed_at)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    const show = () => setVisible(true)
    window.addEventListener('lern:show-onboarding-checklist', show)
    return () => window.removeEventListener('lern:show-onboarding-checklist', show)
  }, [])

  const load = async () => {
    if (!user) return
    const { data } = role === 'employer'
      ? await getEmployerOnboardingProgress(user.id)
      : await (user.organisation_id ? getOrgOnboardingProgress(user.organisation_id) : Promise.resolve({ data: null }))
    if (data) setProgress(data)
  }

  useEffect(() => { load() }, [pathname, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = async () => {
    setVisible(false)
    if (user && !user.onboarding_completed_at) {
      await markOnboardingSeen(user.id)
      await refreshUser()
    }
  }

  if (!visible || !progress) return null

  const items = checklistItemsFor(role)
  const doneCount = items.filter(i => progress[i.key]).length
  const allDone = doneCount === items.length

  return createPortal((
    <div data-theme={theme} className="fixed bottom-5 right-5 z-[90] w-[320px] max-w-[calc(100vw-40px)]">
      <div className="bg-surface border border-edge rounded-2xl shadow-2xl overflow-hidden">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3.5 hover:bg-surface-muted transition"
        >
          <div className="flex items-center gap-2 min-w-0">
            {allDone
              ? <PartyPopper className="w-4 h-4 flex-shrink-0" style={{ color: '#D4551A' }} />
              : (
                <span className="relative w-5 h-5 flex-shrink-0">
                  <svg viewBox="0 0 20 20" className="w-5 h-5 -rotate-90">
                    <circle cx="10" cy="10" r="8" fill="none" stroke="var(--border)" strokeWidth="3" />
                    <circle
                      cx="10" cy="10" r="8" fill="none" stroke="#D4551A" strokeWidth="3"
                      strokeDasharray={`${(doneCount / items.length) * 50.3} 50.3`} strokeLinecap="round"
                    />
                  </svg>
                </span>
              )}
            <span className="text-[13.5px] font-bold text-ink truncate">{allDone ? "You're all set!" : CHECKLIST_TITLE[role]}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[11.5px] font-semibold text-ink-tertiary">{doneCount}/{items.length}</span>
            {collapsed ? <ChevronUp className="w-3.5 h-3.5 text-ink-tertiary" /> : <ChevronDown className="w-3.5 h-3.5 text-ink-tertiary" />}
          </div>
        </button>

        {!collapsed && (
          <div className="px-2 pb-2">
            {items.map(item => {
              const done = !!progress[item.key]
              const Icon = item.icon
              return (
                <div key={item.key} className={`flex items-start gap-2.5 px-2.5 py-2.5 rounded-xl ${done ? 'opacity-50' : ''}`}>
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: done ? '#0F6E56' : 'var(--surface-muted)' }}
                  >
                    {done ? <Check className="w-3 h-3 text-white" /> : <Icon className="w-3 h-3 text-ink-tertiary" />}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[13px] font-semibold text-ink leading-tight ${done ? 'line-through' : ''}`}>{item.label}</p>
                    {!done && <p className="text-[11.5px] text-ink-tertiary leading-snug mt-0.5">{item.hint}</p>}
                  </div>
                </div>
              )
            })}
            <button
              onClick={dismiss}
              className="w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-ink-tertiary hover:text-ink transition py-2 mt-1"
            >
              <X className="w-3 h-3" /> Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  ), document.body)
}

// Settings' "Show setup checklist" row dispatches this -- no prop
// drilling needed to reach a component mounted at the layout root.
export function showOnboardingChecklist() {
  window.dispatchEvent(new Event('lern:show-onboarding-checklist'))
}
