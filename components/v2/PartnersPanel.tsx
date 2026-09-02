'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getEmployerPartners } from '@/lib/supabase'
import { Building2 } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = { institution: 'School', provider: 'Training provider' }

// Complete Build Spec v1.0, Part 3 -- "The schools, colleges, training
// providers... the employer is connected to." Derived from real
// interaction (applications), not a separate connect/invite flow that
// doesn't exist yet -- see getEmployerPartners for why.
export default function PartnersPanel() {
  const { user } = useAuth()
  const [partners, setPartners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getEmployerPartners(user.id).then(({ data }) => { setPartners(data || []); setLoading(false) })
  }, [user?.id])

  return (
    <div>
      <p className="text-[18px] font-medium text-ink mb-1">Partners</p>
      <p className="text-[13px] text-ink-tertiary mb-5">Every under-18 hire routes through the young person's organisation — this is where those relationships live.</p>

      {loading ? (
        <p className="text-[13px] text-ink-tertiary">Loading…</p>
      ) : partners.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-7 h-7 text-ink-quaternary mx-auto mb-2.5" />
          <p className="text-[14px] font-semibold text-ink mb-1">No partners yet</p>
          <p className="text-[13px] text-ink-tertiary">Organisations show up here once a candidate of theirs is in your pipeline.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {partners.map(p => (
            <div key={p.id} className="bg-surface border border-edge rounded-2xl p-5">
              <p className="text-[15px] font-medium text-ink mb-0.5">{p.name}</p>
              <p className="text-[12px] text-ink-tertiary mb-3">{TYPE_LABEL[p.type] || p.type}</p>
              <p className="text-[12px] text-ink-tertiary">{p.reached} young {p.reached === 1 ? 'person' : 'people'} reached · {p.hired} hired</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
