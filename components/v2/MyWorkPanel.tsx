'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getVisibleWorkItems, getMySubmissions, submitWork, uploadSubmissionFile, setShareVisibility, getSignedFileUrl, redeemJoinCode } from '@/lib/supabase'
import { PrimaryButton, SecondaryButton, TextField, ErrorBanner } from '@/components/v2/Field'
import type { WorkItem, Submission } from '@/lib/types'
import { CheckCircle2, Clock, RotateCcw, Ban, Globe, Users, Paperclip, X, Video, MapPin, KeyRound } from 'lucide-react'
import WorkshopSession from '@/components/v2/WorkshopSession'

const STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  submitted: { label: 'Awaiting review', cls: 'bg-[#FFF3E4] text-[#B3651E]', icon: Clock },
  returned: { label: 'Returned — resubmit below', cls: 'bg-[#F5F1E8] text-[#8A8373]', icon: RotateCcw },
  verified: { label: 'Verified', cls: 'bg-[#E9F6EC] text-[#1E7A34]', icon: CheckCircle2 },
  revoked: { label: 'Revoked', cls: 'bg-[#FDEEEA] text-[#B3401E]', icon: Ban },
}

function isAdult(dob?: string): boolean {
  if (!dob) return false
  const age = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  return age >= 18
}

export default function MyWorkPanel() {
  const { user, refreshUser } = useAuth()
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openWorkItemId, setOpenWorkItemId] = useState<string | null>(null)

  const load = () => {
    if (!user?.organisation_id) return
    Promise.all([
      getVisibleWorkItems(user.organisation_id),
      getMySubmissions(user.id),
    ]).then(([wi, subs]) => {
      setWorkItems(wi.data || [])
      setSubmissions(subs.data || [])
      setLoading(false)
    })
  }
  useEffect(load, [user?.organisation_id, user?.id])

  // Explore mode: signed up without a code yet. Not an error state --
  // just inert until they link to an organisation, which they can only
  // do here.
  if (!user?.organisation_id) return <JoinCodePrompt onJoined={refreshUser} />

  if (loading) return <p className="text-[#8A8373] text-[14px]">Loading…</p>

  return (
    <div className="space-y-3">
      {workItems.length === 0 && <p className="text-[#8A8373] text-[14px]">Nothing set for you yet — check back once your organisation posts a brief or course.</p>}
      {workItems.map(item => {
        const mySubs = submissions.filter(s => s.work_item_id === item.id)
        const latest = mySubs[0]
        return (
          <WorkItemCard
            key={item.id} item={item} latest={latest} allSubs={mySubs}
            open={openWorkItemId === item.id}
            onToggle={() => setOpenWorkItemId(o => o === item.id ? null : item.id)}
            onSubmitted={load}
          />
        )
      })}
    </div>
  )
}

function WorkItemCard({
  item, latest, allSubs, open, onToggle, onSubmitted,
}: { item: WorkItem; latest: any; allSubs: any[]; open: boolean; onToggle: () => void; onSubmitted: () => void }) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [inSession, setInSession] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const status = latest ? STATUS[latest.status] : null
  const canSubmit = !latest || latest.status === 'returned'
  const StatusIcon = status?.icon

  const handleSubmit = async () => {
    setError('')
    if (!content.trim() && !file) return setError('Write, link, or attach your work before submitting.')
    if (!user) return
    setLoading(true)
    let fileInfo: { path: string; type: string; size: number } | undefined
    if (file) {
      const { path, error: uploadError } = await uploadSubmissionFile(user.id, file)
      if (uploadError || !path) { setLoading(false); return setError(uploadError?.message || 'File upload failed.') }
      fileInfo = { path, type: file.type, size: file.size }
    }
    const { error: submitError } = await submitWork(user.id, item.id, content.trim(), fileInfo)
    setLoading(false)
    if (submitError) return setError(submitError.message)
    setContent(''); setFile(null)
    onSubmitted()
  }

  return (
    <div className="border border-[#EDE9E1] rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-[#FBF9F4] transition">
        <div className="min-w-0">
          <p className="font-semibold text-ink text-[14px] truncate">{item.title}</p>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8373]">{item.type}</span>
        </div>
        {status && StatusIcon && (
          <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${status.cls}`}>
            <StatusIcon className="w-3 h-3" /> {status.label}
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[#EDE9E1] pt-4">
          <p className="text-[12px] font-semibold text-[#8A8373] uppercase tracking-wide mb-1">Criteria</p>
          <p className="text-[13px] text-[#4A453B] mb-4">{item.criteria}</p>

          {item.type === 'workshop' && (
            <div className="mb-4">
              {item.mode === 'online' && item.ended_at ? (
                <span className="inline-flex items-center gap-1.5 bg-[#F5F1E8] text-[#8A8373] font-semibold text-[13px] px-4 py-2 rounded-lg">
                  <Video className="w-4 h-4" /> Ended
                </span>
              ) : item.mode === 'online' ? (
                <button
                  onClick={() => setInSession(true)}
                  className="flex items-center gap-1.5 bg-[#1E7A34] text-white font-semibold text-[13px] px-4 py-2 rounded-lg hover:bg-[#186229] transition"
                >
                  <Video className="w-4 h-4" /> Join session
                </button>
              ) : item.location && (
                <p className="flex items-center gap-1.5 text-[13px] text-[#6B6558]"><MapPin className="w-4 h-4" /> {item.location}</p>
              )}
            </div>
          )}
          {inSession && <WorkshopSession workItemId={item.id} title={item.title} onClose={() => setInSession(false)} />}

          {allSubs.length > 0 && (
            <div className="space-y-2 mb-4">
              {allSubs.map((s: any) => <SubmissionHistoryRow key={s.id} submission={s} />)}
            </div>
          )}

          {canSubmit && (
            <>
              <ErrorBanner message={error} />
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Paste a link, or write your work here."
                rows={4}
                className="w-full bg-white border border-[#E2DDD1] rounded-xl px-4 py-3 text-[14px] text-ink placeholder-[#A39C8A] outline-none focus:border-brand transition mb-3 resize-none"
              />
              <button
                type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6B6558] hover:text-brand transition mb-3"
              >
                <Paperclip className="w-3.5 h-3.5" /> {file ? file.name : 'Attach a file (optional)'}
                {file && (
                  <span onClick={e => { e.stopPropagation(); setFile(null) }} className="hover:text-[#B3401E]"><X className="w-3.5 h-3.5" /></span>
                )}
              </button>
              <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              <PrimaryButton onClick={handleSubmit} loading={loading}>
                {latest?.status === 'returned' ? 'Resubmit' : 'Submit work'}
              </PrimaryButton>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SubmissionHistoryRow({ submission }: { submission: any }) {
  const { user } = useAuth()
  const status = STATUS[submission.status]
  const verification = (submission.verifications || []).find((v: any) => !v.revoked_at) || submission.verifications?.[0]
  const adult = isAdult(user?.date_of_birth)
  const [busy, setBusy] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  useEffect(() => {
    if (submission.file_path) getSignedFileUrl('submission-files', submission.file_path).then(({ url }) => setFileUrl(url))
  }, [submission.file_path])

  const toggleVisibility = async () => {
    if (!verification || submission.status !== 'verified') return
    setBusy(true)
    await setShareVisibility(verification.id, verification.visibility === 'public' ? 'organisation' : 'public')
    setBusy(false)
    window.location.reload() // simplest way to reflect the new visibility right now
  }

  return (
    <div className="bg-[#FBF9F4] rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
        <span className="text-[11px] text-[#8A8373]">{new Date(submission.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
      </div>
      {submission.content && <p className="text-[13px] text-[#4A453B] whitespace-pre-wrap mb-1">{submission.content}</p>}
      {submission.file_path && (
        <a href={fileUrl || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline mb-1">
          <Paperclip className="w-3 h-3" /> {submission.file_path.split('/').pop()}
        </a>
      )}

      {submission.status === 'verified' && verification && !verification.revoked_at && (
        <div className="mt-2 pt-2 border-t border-[#EDE9E1] flex items-center justify-between">
          <span className="text-[11px] text-[#8A8373]">
            Verified {new Date(verification.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {adult ? (
            <button onClick={toggleVisibility} disabled={busy} className="flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
              {verification.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Users className="w-3 h-3" />}
              {verification.visibility === 'public' ? 'Public — tap to make org-only' : 'Org only — tap to make public'}
            </button>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-[#8A8373]">
              <Users className="w-3 h-3" /> Visible to your organisation only
            </span>
          )}
        </div>
      )}

      {submission.status === 'revoked' && verification?.revocation_reason && (
        <p className="text-[12px] text-[#B3401E] mt-1">Revoked: {verification.revocation_reason}</p>
      )}
    </div>
  )
}

// "Entering a valid code (via My Work, Private) links them to their
// organisation and unlocks everything" — this is that entry point.
function JoinCodePrompt({ onJoined }: { onJoined: () => Promise<void> }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoin = async () => {
    setError('')
    if (!code.trim()) return setError('Enter your join code.')
    setLoading(true)
    const { error: redeemError } = await redeemJoinCode(code)
    if (redeemError) { setLoading(false); return setError('That code isn’t valid, has expired, or has been revoked. Check it with your school, college or provider.') }
    await onJoined()
    setLoading(false)
  }

  return (
    <div className="bg-white border border-[#E2DDD1] rounded-2xl p-8 text-center max-w-md mx-auto">
      <div className="w-11 h-11 rounded-full bg-[#FCEEE4] flex items-center justify-center mx-auto mb-4">
        <KeyRound className="w-5 h-5 text-brand" />
      </div>
      <p className="font-bold text-ink text-[16px] mb-1.5">You're not linked to an organisation yet</p>
      <p className="text-[13px] text-[#8A8373] mb-5 leading-relaxed">
        Enter the code your school, college or training provider gave you to unlock briefs, courses, and submitting your own work.
      </p>
      <ErrorBanner message={error} />
      <TextField label="Join code" value={code} onChange={v => setCode(v.toUpperCase())} placeholder="e.g. 7K3P9XQZ" />
      <PrimaryButton onClick={handleJoin} loading={loading}>Join</PrimaryButton>
    </div>
  )
}
