'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrgInterest, respondToInterest } from '@/lib/supabase'
import { Check, Ban, Clock, ShieldCheck } from 'lucide-react'

function isAdult(dob?: string) {
  if (!dob) return false
  return (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25) >= 18
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-warning-bg-soft text-warning-text' },
  accepted: { label: 'Accepted', cls: 'bg-success-bg text-success-text' },
  declined: { label: 'Declined', cls: 'bg-surface-muted text-ink-tertiary' },
}

// Under-18: this table is the ONLY place that student's interest is
// visible at all (RLS gives them no read path to it themselves) — staff
// respond on their behalf. An 18+ student can now see and act on their
// own interest too (Discover -> Interest received), so this stays
// visible for adults but reads as informational rather than the only
// route.
export default function InterestReceivedPanel() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    if (!user?.organisation_id) return
    getOrgInterest(user.organisation_id).then(({ data }) => { setItems(data || []); setLoading(false) })
  }
  useEffect(load, [user?.organisation_id])

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    await respondToInterest(id, status)
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">Interest received</h1>
        <p className="text-ink-tertiary text-[14px]">Employers who've expressed interest in your students' verified work.</p>
      </div>

      {loading ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-accent-bg flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5 text-brand" />
          </div>
          <p className="font-bold text-ink text-[15px] mb-1.5">Nothing yet</p>
          <p className="text-ink-tertiary text-[14px]">When an employer expresses interest in one of your students, it'll show up here first.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(i => {
            const status = STATUS[i.status]
            const adult = isAdult(i.student?.date_of_birth)
            return (
              <div key={i.id} className="bg-surface border border-edge rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink text-[15px]">{i.student?.full_name || 'A student'}</p>
                    <p className="text-[13px] text-ink-tertiary">
                      Interest from <span className="font-semibold text-ink-secondary">{i.employer?.full_name || 'an employer'}</span>
                      {' · '}{new Date(i.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${adult ? 'bg-surface-muted text-ink-tertiary' : 'bg-accent-bg text-brand'}`}>
                    {adult ? '18+' : 'Under 18 — routed to you'}
                  </span>
                </div>

                {i.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button onClick={() => respond(i.id, 'accepted')} className="flex items-center gap-1.5 bg-success-solid text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-success-solid-hover transition">
                      <Check className="w-3.5 h-3.5" /> Accept
                    </button>
                    <button onClick={() => respond(i.id, 'declined')} className="flex items-center gap-1.5 bg-surface border border-edge text-ink-secondary text-[13px] font-semibold px-4 py-2 rounded-lg hover:border-danger-text hover:text-danger-text transition">
                      <Ban className="w-3.5 h-3.5" /> Decline
                    </button>
                  </div>
                ) : (
                  <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full ${status.cls}`}>
                    {i.status === 'pending' && <Clock className="w-3.5 h-3.5" />} {status.label}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
