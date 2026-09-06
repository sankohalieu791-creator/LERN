'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getEmployerInterest, getEmployerInboxItems, getInterestMessages, sendInterestMessage } from '@/lib/supabase'
import { Send, Inbox as InboxIcon, ArrowLeft, Shield, Lock, Check } from 'lucide-react'

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
function age(dob?: string) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}
function isAdult(dob?: string) {
  const a = age(dob)
  return a !== null && a >= 18
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Awaiting reply', bg: '#FAEEDA', fg: '#854F0B' },
  accepted: { label: 'Accepted', bg: '#E1F5EE', fg: '#0F6E56' },
  declined: { label: 'Declined', bg: 'var(--surface-muted)', fg: 'var(--text-tertiary)' },
}

// Real two-way messaging, not an activity feed -- this is the exact
// same interest/interest_messages thread InterestReceivedPanel shows
// an org, just from the employer's side of it. Before this, an
// employer's own message to a school landed nowhere they could ever
// see a reply: the backend (interest_messages, sendInterestMessage)
// already existed and worked for the org side, but nothing on this
// side ever called it. Application activity (a student applying to a
// posted role -- a different, non-conversational thing) still shows,
// just in its own section below the real conversations.
export default function EmployerInboxPanel() {
  const { user } = useAuth()
  const [threads, setThreads] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = () => {
    if (!user) return
    Promise.all([
      getEmployerInterest(user.id),
      getEmployerInboxItems(user.id),
    ]).then(([{ data: threadData }, { data: activityData }]) => {
      setThreads(threadData || [])
      setApplications((activityData || []).filter((a: any) => a.icon === 'application'))
      setLoading(false)
    })
  }
  useEffect(load, [user?.id])

  const open = threads.find(t => t.id === openId) || null
  if (open) return <EmployerThread item={open} onBack={() => setOpenId(null)} />

  return (
    <div>
      <p className="text-[22px] font-bold text-ink mb-1">Inbox</p>
      <p className="text-[14px] text-ink-tertiary mb-6">Conversations about candidates you've reached out to, and activity on your open roles.</p>

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-surface animate-pulse" />)}
        </div>
      ) : threads.length === 0 && applications.length === 0 ? (
        <div className="text-center py-20 bg-surface border border-edge-subtle rounded-2xl">
          <InboxIcon className="w-8 h-8 text-ink-quaternary mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-ink mb-1">Nothing yet</p>
          <p className="text-[13px] text-ink-tertiary">Reach out to a candidate from Discover to start a conversation.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {threads.length > 0 && (
            <div>
              <p className="text-[12px] font-bold text-ink-tertiary uppercase tracking-wide mb-2.5 px-1">Conversations</p>
              <div className="bg-surface border border-edge rounded-2xl divide-y divide-edge-subtle overflow-hidden">
                {threads.map(t => {
                  const status = STATUS_META[t.status] || STATUS_META.pending
                  const firstName = (t.student?.full_name || 'A student').split(' ')[0]
                  return (
                    <button key={t.id} onClick={() => setOpenId(t.id)} className="w-full flex items-center gap-3.5 px-4 py-4 text-left hover:bg-surface-subtle transition">
                      <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold text-[13px]" style={{ backgroundColor: '#185FA5' }}>
                        {initials(t.student?.full_name)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ink text-[14.5px] truncate">{firstName}{t.opportunity_label ? ` · ${t.opportunity_label}` : ''}</p>
                        {t.message && <p className="text-[13px] text-ink-tertiary truncate mt-0.5">{t.message}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: status.bg, color: status.fg }}>{status.label}</span>
                        <span className="text-[11.5px] text-ink-quaternary whitespace-nowrap">{timeAgo(t.created_at)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {applications.length > 0 && (
            <div>
              <p className="text-[12px] font-bold text-ink-tertiary uppercase tracking-wide mb-2.5 px-1">Applications</p>
              <div className="bg-surface border border-edge rounded-2xl divide-y divide-edge-subtle overflow-hidden">
                {applications.map(a => (
                  <div key={a.id} className="flex items-center gap-3.5 px-4 py-4">
                    <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--brand)' }}>
                      <span className="font-bold text-[13px]">{initials(a.name)}</span>
                    </span>
                    <p className="text-[14.5px] text-ink flex-1 leading-snug">{a.text}</p>
                    <span className="text-[11.5px] text-ink-quaternary whitespace-nowrap flex-shrink-0">{timeAgo(a.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Same thread shape as InterestReceivedPanel's RequestThread, minus
// the accept/decline actions -- that decision belongs to the school,
// not the employer. Replying here calls the exact same
// sendInterestMessage the org side already uses, with sender_role
// 'employer' instead of 'org', so both ends of one conversation are
// finally the same conversation.
function EmployerThread({ item, onBack }: { item: any; onBack: () => void }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<any[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const load = () => { getInterestMessages(item.id).then(({ data }) => setMessages(data || [])) }
  useEffect(load, [item.id])

  const adult = isAdult(item.student?.date_of_birth)
  const firstName = (item.student?.full_name || 'This student').split(' ')[0]
  const status = STATUS_META[item.status] || STATUS_META.pending

  const send = async () => {
    if (!reply.trim() || !user) return
    setSending(true)
    await sendInterestMessage(item.id, user.id, 'employer', reply.trim())
    setReply('')
    await load()
    setSending(false)
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-ink transition mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to inbox
      </button>

      <div className="flex items-start gap-2.5 rounded-xl px-4 py-3.5 mb-4" style={{ backgroundColor: '#E1F5EE' }}>
        <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#0F6E56' }} />
        <p className="text-[13px] leading-relaxed" style={{ color: '#0F6E56' }}>
          {adult
            ? <>{firstName} isn't part of this conversation, but can see it happening. Their organisation's safeguarding lead can see this thread too.</>
            : <>{firstName} is never part of this conversation — their organisation replies on their behalf.</>}
        </p>
      </div>

      <div className="bg-surface border border-edge rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-[12px]" style={{ backgroundColor: '#185FA5' }}>
              {initials(item.student?.full_name)}
            </span>
            <div>
              <p className="font-bold text-ink text-[14px]">{firstName}{item.opportunity_label ? ` · ${item.opportunity_label}` : ''}</p>
              <p className="text-[12px] text-ink-tertiary">Routed through their organisation</p>
            </div>
          </div>
          <span className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: status.bg, color: status.fg }}>{status.label}</span>
        </div>

        <div className="space-y-2.5 mt-4">
          {item.message && <ChatBubble fromOrg={false} body={item.message} />}
          {messages.map(m => <ChatBubble key={m.id} fromOrg={m.sender_role === 'org'} body={m.body} />)}
          {messages.length === 0 && !item.message && (
            <p className="text-[13px] text-ink-tertiary text-center py-6">No messages yet — say why you're interested.</p>
          )}
        </div>

        {item.status !== 'declined' && (
          <div className="mt-4">
            <textarea
              value={reply} onChange={e => setReply(e.target.value)}
              placeholder="Write a message — it goes to the student's organisation, never to the student directly."
              rows={3}
              className="w-full bg-surface-subtle border border-edge rounded-lg px-3.5 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none"
            />
            <button
              onClick={send}
              disabled={sending || !reply.trim()}
              className="flex items-center gap-1.5 bg-brand text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-brand-hover transition disabled:opacity-40 mt-2.5"
            >
              <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        )}
        {item.status === 'declined' && (
          <p className="flex items-center gap-1.5 text-[12px] text-ink-tertiary mt-4">
            <Check className="w-3.5 h-3.5" /> This request was declined — the thread is closed.
          </p>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[12px] text-ink-quaternary">
        <Lock className="w-3 h-3" /> Logged for safeguarding
      </p>
    </div>
  )
}

function ChatBubble({ fromOrg, body }: { fromOrg: boolean; body: string }) {
  return (
    <div className={`flex ${fromOrg ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
        fromOrg ? 'bg-surface-muted text-ink-secondary' : 'bg-accent-bg text-ink'
      }`}>
        {body}
      </div>
    </div>
  )
}
