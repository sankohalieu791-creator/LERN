'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getDiscoverWork, getAllOpportunities } from '@/lib/supabase'
import { BadgeCheck, Megaphone, ShieldCheck } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = { brief: 'Brief', course: 'Course', workshop: 'Workshop' }

function isAdult(dob?: string) {
  if (!dob) return false
  return (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25) >= 18
}

// Same explore content for both ages — verified public work to learn
// from, and open opportunities to browse — the age split the spec
// calls for is entirely about what happens AFTER that (who an
// interest/application actually reaches), which is why the routing
// note below changes by age even though the list above doesn't.
export default function DiscoverPanel() {
  const { user } = useAuth()
  const adult = isAdult(user?.date_of_birth)
  const [tab, setTab] = useState<'work' | 'opportunities'>('work')
  const [work, setWork] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDiscoverWork().then(({ data }) => { setWork(data || []); setLoading(false) })
    getAllOpportunities().then(({ data }) => setOpportunities(data || []))
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink mb-1">Discover</h1>
        <p className="text-[13px] text-ink-tertiary">
          {adult
            ? "Explore verified work, and jobs or apprenticeships you can apply to."
            : "Explore verified work and opportunities — any interest you show is routed through your organisation, never straight to an employer."}
        </p>
      </div>

      <div className="flex gap-1 bg-surface-muted rounded-xl p-1">
        {(['work', 'opportunities'] as const).map(t => (
          <button
            key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold transition ${tab === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-tertiary'}`}
          >
            {t === 'work' ? 'Verified work' : 'Opportunities'}
          </button>
        ))}
      </div>

      {tab === 'work' ? (
        loading ? (
          <p className="text-[13px] text-ink-tertiary">Loading…</p>
        ) : work.length === 0 ? (
          <div className="bg-surface border border-edge rounded-2xl p-8 text-center">
            <p className="text-[13px] text-ink-tertiary">Nothing public yet — check back soon.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {work.map(v => {
              const wi = v.submissions?.work_items
              return (
                <div key={v.id} className="bg-surface border border-edge rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10.5px] font-semibold text-ink-tertiary uppercase tracking-wide">{TYPE_LABEL[wi?.type] || wi?.type}</span>
                    <span className="flex items-center gap-1 text-[11.5px] font-semibold text-success-text"><BadgeCheck className="w-3.5 h-3.5" /> Verified</span>
                  </div>
                  <p className="font-bold text-ink text-[14px] mb-1">{wi?.title}</p>
                  {wi?.description && <p className="text-[13px] text-ink-tertiary line-clamp-2">{wi.description}</p>}
                  <p className="text-[11.5px] text-ink-tertiary mt-2">
                    {v.submissions?.student?.full_name} · {new Date(v.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )
            })}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {opportunities.length === 0 ? (
            <div className="bg-surface border border-edge rounded-2xl p-8 flex flex-col items-center text-center">
              <Megaphone className="w-5 h-5 text-ink-tertiary mb-2" />
              <p className="text-[13px] text-ink-tertiary">No opportunities posted yet.</p>
            </div>
          ) : (
            opportunities.map(o => (
              <div key={o.id} className="bg-surface border border-edge rounded-2xl p-4">
                <p className="font-bold text-ink text-[14px] mb-1">{o.title}</p>
                {o.description && <p className="text-[13px] text-ink-tertiary mb-2">{o.description}</p>}
                <p className="text-[11.5px] text-ink-quaternary">Posted {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            ))
          )}
          <div className="bg-surface-subtle border border-edge-subtle rounded-2xl p-4 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-ink-secondary leading-relaxed">
              {adult
                ? "Applying and \"Interest received\" — seeing which employers are interested in you — are being built next."
                : "Expressing interest is being built next. When it's live, any interest always goes to your organisation first — an employer never contacts you directly."}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
