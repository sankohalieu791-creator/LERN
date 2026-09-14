'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getGuestProfiles, getMyInterest, expressInterest, getStudentsAdultStatus, getGuestContext } from '@/lib/supabase'
import { useAvatarUrl } from '@/lib/useAvatarUrl'
import { BadgeCheck, Send, Check, Clock, ShieldCheck, Building2, Eye, Briefcase } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = { brief: 'Brief', course: 'Course', workshop: 'Workshop' }

// Build Spec follow-up (14 Sep): "when a link or institution has been
// invited they only see the profile of the student where they see
// verified work and experience, not post or saved jobs." Taken
// literally -- exactly those two things. An earlier cut of this also
// showed bio and self-declared qualifications, copied wholesale from
// CandidateProfileModal (the full-employer Discover view); on a real
// account with any of those filled in, that reads as "the whole
// account", not a scoped profile -- removed both, here and in
// app/api/guest/profiles/route.ts which no longer even fetches them.
// One profile block per shared student: avatar/name header, an
// Experience strip, then the list of verified work. Still nothing to
// browse beyond what was explicitly shared -- getGuestProfiles() is
// scoped server-side to exactly this guest's guest_invite_shares rows,
// never a general employer-style query.
export default function GuestSharedWorkPanel() {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [interestByStudent, setInterestByStudent] = useState<Record<string, string>>({})
  const [adultByStudent, setAdultByStudent] = useState<Record<string, boolean>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [context, setContext] = useState<{ organisationName: string | null; studentNames: string[] } | null>(null)

  useEffect(() => {
    getGuestProfiles().then(({ data }) => {
      setProfiles(data || [])
      setLoading(false)
      const ids = Array.from(new Set((data || []).map((p: any) => p.student?.id).filter(Boolean))) as string[]
      if (ids.length) getStudentsAdultStatus(ids).then(setAdultByStudent)
    })
    getGuestContext().then(({ data }) => setContext(data))
  }, [])

  useEffect(() => {
    if (!user) return
    getMyInterest(user.id).then(({ data }) => {
      const map: Record<string, string> = {}
      for (const i of data || []) map[i.student_id] = i.status
      setInterestByStudent(map)
    })
  }, [user])

  const handleExpress = async (studentId: string) => {
    if (!user) return
    setSending(studentId)
    const { error } = await expressInterest(user.id, studentId)
    setSending(null)
    if (!error) setInterestByStudent(prev => ({ ...prev, [studentId]: 'pending' }))
  }

  const studentHeading = context?.studentNames.length
    ? context.studentNames.length === 1 ? context.studentNames[0] : context.studentNames.join(', ')
    : null

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">
          {studentHeading ? `${studentHeading} — Verified profile shared with you` : 'Verified profile shared with you'}
        </h1>
        <p className="text-ink-tertiary text-[14px]">
          {context?.organisationName ? `Shared by ${context.organisationName}. ` : ''}
          Interest is always routed through the organisation — you're never given direct contact details.
        </p>
      </div>

      {/* Required wording, verbatim -- this is a single scoped page, not
          a logged-in account view, and it needs to say so plainly. */}
      <div className="flex items-start gap-2.5 rounded-xl px-4 py-3.5" style={{ backgroundColor: '#E1F5EE' }}>
        <Eye className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#0F6E56' }} />
        <p className="text-[13px] leading-relaxed" style={{ color: '#0F6E56' }}>
          You are viewing shared work only. You cannot see any other students or content on LERN.
        </p>
      </div>

      {loading ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : profiles.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-accent-bg flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5 text-brand" />
          </div>
          <p className="font-bold text-ink text-[15px] mb-1.5">Nothing shared yet</p>
          <p className="text-ink-tertiary text-[14px]">Ask the organisation that invited you — they may not have finished sharing anything with this link yet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {profiles.map(p => (
            <StudentProfileCard
              key={p.student.id} profile={p}
              status={interestByStudent[p.student.id]}
              adult={adultByStudent[p.student.id] === true}
              sending={sending === p.student.id}
              onExpressInterest={() => handleExpress(p.student.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StudentProfileCard({ profile, status, adult, sending, onExpressInterest }: {
  profile: { student: { id: string; full_name: string; avatar_path?: string }; verifications: any[]; experience: any[] }
  status?: string
  adult: boolean
  sending: boolean
  onExpressInterest: () => void
}) {
  const { student, verifications, experience } = profile
  const avatarUrl = useAvatarUrl(student.avatar_path)

  return (
    <div className="bg-surface border border-edge rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
          ) : (
            <span className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-bold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
              {(student.full_name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-bold text-ink text-[16px] truncate">{student.full_name}</p>
            <p className="flex items-center gap-1 text-[12px] font-semibold text-success-text">
              <BadgeCheck className="w-3.5 h-3.5" /> {verifications.length} verified {verifications.length === 1 ? 'piece' : 'pieces'} of work
            </p>
          </div>
        </div>

        <div className="flex-shrink-0">
          {status === 'pending' ? (
            <span className="flex items-center gap-1 text-[12px] font-semibold text-warning-text"><Clock className="w-3.5 h-3.5" /> {adult ? 'Pending' : 'Routed to their organisation'}</span>
          ) : status === 'accepted' ? (
            <span className="flex items-center gap-1 text-[12px] font-semibold text-success-text"><Check className="w-3.5 h-3.5" /> Accepted</span>
          ) : status === 'declined' ? (
            <span className="text-[12px] font-semibold text-ink-tertiary">Declined</span>
          ) : adult ? (
            <button
              onClick={onExpressInterest} disabled={sending}
              className="flex items-center gap-1.5 bg-brand text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Place your offer'}
            </button>
          ) : (
            <button
              onClick={onExpressInterest} disabled={sending}
              className="flex items-center gap-1.5 bg-surface border border-edge text-ink-secondary text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:border-brand hover:text-brand transition disabled:opacity-50"
            >
              <Building2 className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Contact their institution/provider'}
            </button>
          )}
        </div>
      </div>

      {experience.length > 0 && (
        <div className="bg-surface-subtle rounded-xl p-3 mb-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2"><Briefcase className="w-3 h-3" /> Experience</p>
          <div className="space-y-1.5">
            {experience.slice(0, 4).map((e: any) => (
              <p key={e.id} className="text-[12.5px] text-ink truncate">{e.title}{e.organisation ? ` · ${e.organisation}` : ''}</p>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2">Verified work</p>
      {verifications.length === 0 ? (
        <p className="text-[13px] text-ink-tertiary">Nothing verified yet.</p>
      ) : (
        <div className="space-y-2.5">
          {verifications.map((v: any) => {
            const wi = v.submissions?.work_items
            return (
              <div key={v.id} className="bg-surface-subtle rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">{TYPE_LABEL[wi?.type] || wi?.type}</span>
                  {wi?.organisations?.name && <span className="text-[11px] text-ink-tertiary flex-shrink-0">{wi.organisations.name}</span>}
                </div>
                <p className="text-[13px] font-semibold text-ink">{wi?.title}</p>
                {wi?.description && <p className="text-[12.5px] text-ink-tertiary line-clamp-2 mb-1">{wi.description}</p>}
                {v.submissions?.content && <p className="text-[12.5px] text-ink-secondary line-clamp-2">{v.submissions.content}</p>}
                <p className="text-[11px] text-ink-tertiary mt-1.5">
                  Verified by {v.verifier?.full_name || 'a reviewer'} · {new Date(v.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
