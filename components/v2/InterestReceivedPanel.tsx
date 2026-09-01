'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getOrgInterest, respondToInterest, getInterestMessages, sendInterestMessage, closeInterestThread,
} from '@/lib/supabase'
import { Check, Ban, Shield, Lock, Send, ArrowLeft } from 'lucide-react'

function age(dob?: string) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}
function isAdult(dob?: string) {
  const a = age(dob)
  return a !== null && a >= 18
}
function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

// LERN Build Spec: Briefs and Interest Received v1.0 -- "Requests".
// Under-18 is the default, safe path: the young person is structurally
// absent from the thread, always. An 18+ learner gets the same card
// and thread shape for consistency, but the copy relaxes from "routes
// through you" (required intermediary) to "you can see this exchange"
// (visibility, not a requirement) -- the org-mediated mechanism itself
// stays the same either way; only what it's framed as changes.
export default function InterestReceivedPanel() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = () => {
    if (!user?.organisation_id) return
    getOrgInterest(user.organisation_id).then(({ data }) => { setItems(data || []); setLoading(false) })
  }
  useEffect(load, [user?.organisation_id])

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    await respondToInterest(id, status)
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  const open = items.find(i => i.id === openId) || null
  const needResponse = items.filter(i => i.status === 'pending').length

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setOpenId(null)}
          className={`px-4 py-2 rounded-full text-[13px] font-semibold border transition ${
            !open ? 'bg-ink text-paper border-ink' : 'border-edge text-ink-secondary hover:border-edge-input'
          }`}
        >
          Requests
        </button>
        <button
          disabled={!open}
          className={`px-4 py-2 rounded-full text-[13px] font-semibold border transition disabled:opacity-40 ${
            open ? 'bg-ink text-paper border-ink' : 'border-edge text-ink-secondary'
          }`}
        >
          Open a request
        </button>
      </div>

      {open ? (
        <RequestThread item={open} onBack={() => setOpenId(null)} onRespond={respond} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h1 className="text-2xl font-bold text-ink">Employer requests</h1>
              <p className="text-ink-tertiary text-[14px] mt-0.5">Interest in your students, routed to you</p>
            </div>
            {needResponse > 0 && (
              <span className="flex-shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: '#FAEEDA', color: '#854F0B' }}>
                {needResponse} need{needResponse === 1 ? 's' : ''} a response
              </span>
            )}
          </div>

          {loading ? (
            <p className="text-ink-tertiary text-[14px]">Loading…</p>
          ) : items.length === 0 ? (
            <div className="bg-surface border border-edge rounded-2xl p-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-accent-bg flex items-center justify-center mb-3">
                <Shield className="w-5 h-5 text-brand" />
              </div>
              <p className="font-bold text-ink text-[15px] mb-1.5">Nothing yet</p>
              <p className="text-ink-tertiary text-[14px]">When an employer's interested in one of your students, it'll show up here first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(i => {
                const adult = isAdult(i.student?.date_of_birth)
                const studentAge = age(i.student?.date_of_birth)
                const firstName = (i.student?.full_name || 'A student').split(' ')[0]
                const lastInitial = (i.student?.full_name || '').split(' ')[1]?.[0]
                return (
                  <div key={i.id} className="bg-surface border border-edge rounded-xl px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-[13px]" style={{ backgroundColor: '#185FA5' }}>
                        {initials(i.employer?.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-ink text-[15px] truncate">{i.employer?.full_name || 'An employer'}</p>
                          {i.status === 'pending' ? (
                            <span className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>New</span>
                          ) : i.status === 'accepted' ? (
                            <span className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E1F5EE', color: '#0F6E56' }}>Accepted</span>
                          ) : (
                            <span className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-muted text-ink-tertiary">Declined</span>
                          )}
                        </div>
                        <p className="text-[13px] text-ink-tertiary mt-0.5">
                          Interested in <span className="font-semibold text-ink-secondary">{firstName}{lastInitial ? ` ${lastInitial}.` : ''}</span>
                          {i.opportunity_label ? ` · ${i.opportunity_label}` : ''}
                        </p>

                        {i.message && (
                          <div className="bg-surface-muted rounded-lg px-3.5 py-2.5 mt-3">
                            <p className="text-[13px] text-ink-secondary italic">"{i.message}"</p>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3">
                          <p className="flex items-center gap-1.5 text-[12px] text-ink-tertiary">
                            <Shield className="w-3.5 h-3.5" />
                            {studentAge !== null ? `${firstName} is ${studentAge}` : firstName}
                            {' · '}{adult ? 'you can see this exchange' : 'contact routes through you'}
                          </p>
                          <button onClick={() => setOpenId(i.id)} className="flex items-center gap-1 text-[13px] font-semibold hover:underline flex-shrink-0" style={{ color: '#185FA5' }}>
                            Open ↗
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RequestThread({ item, onBack, onRespond }: { item: any; onBack: () => void; onRespond: (id: string, status: 'accepted' | 'declined') => void }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<any[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const load = () => { getInterestMessages(item.id).then(({ data }) => setMessages(data || [])) }
  useEffect(load, [item.id])

  const adult = isAdult(item.student?.date_of_birth)
  const firstName = (item.student?.full_name || 'This student').split(' ')[0]

  const send = async (alsoAccept: boolean) => {
    if (!reply.trim() || !user) return
    setSending(true)
    if (alsoAccept && item.status === 'pending') await onRespond(item.id, 'accepted')
    await sendInterestMessage(item.id, user.id, 'org', reply.trim())
    setReply('')
    await load()
    setSending(false)
  }

  const decline = async () => {
    await onRespond(item.id, 'declined')
    await closeInterestThread(item.id)
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-ink transition mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to requests
      </button>

      {/* The safeguarding banner -- deliberately prominent, not decoration.
          It reassures the school and trains staff to do the right thing. */}
      <div className="flex items-start gap-2.5 rounded-xl px-4 py-3.5 mb-4" style={{ backgroundColor: '#E1F5EE' }}>
        <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#0F6E56' }} />
        <p className="text-[13px] leading-relaxed" style={{ color: '#0F6E56' }}>
          {adult
            ? <>{firstName} isn't part of this conversation, but can see it happening — your safeguarding lead can see this thread too.</>
            : <>{firstName} is not part of this conversation. You reply on their behalf. Your safeguarding lead can see this thread.</>}
        </p>
      </div>

      <div className="bg-surface border border-edge rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-[12px]" style={{ backgroundColor: '#185FA5' }}>
            {initials(item.employer?.full_name)}
          </div>
          <div>
            <p className="font-bold text-ink text-[14px]">{item.employer?.full_name || 'An employer'}</p>
            <p className="text-[12px] text-ink-tertiary">Interested in {firstName}{item.opportunity_label ? ` · ${item.opportunity_label}` : ''}</p>
          </div>
        </div>

        <div className="space-y-2.5 mt-4">
          {item.message && <ChatBubble fromEmployer body={item.message} />}
          {messages.map(m => <ChatBubble key={m.id} fromEmployer={m.sender_role === 'employer'} body={m.body} />)}
        </div>

        {item.status !== 'declined' && (
          <div className="mt-4">
            <textarea
              value={reply} onChange={e => setReply(e.target.value)}
              placeholder="Reply on the student's behalf — never share personal contact details."
              rows={3}
              className="w-full bg-surface-subtle border border-edge rounded-lg px-3.5 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none"
            />
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={() => send(item.status === 'pending')}
                disabled={sending || !reply.trim()}
                className="flex items-center gap-1.5 bg-brand text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-brand-hover transition disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" /> {item.status === 'pending' ? 'Accept and reply' : 'Reply'}
              </button>
              {item.status === 'pending' && (
                <button onClick={decline} className="flex items-center gap-1.5 bg-surface border border-edge text-ink-secondary text-[13px] font-semibold px-4 py-2 rounded-lg hover:border-danger-text hover:text-danger-text transition">
                  <Ban className="w-3.5 h-3.5" /> Decline
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[12px] text-ink-quaternary">
        <Lock className="w-3 h-3" /> Logged for safeguarding
      </p>
    </div>
  )
}

function ChatBubble({ fromEmployer, body }: { fromEmployer: boolean; body: string }) {
  return (
    <div className={`flex ${fromEmployer ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
        fromEmployer ? 'bg-surface-muted text-ink-secondary' : 'bg-accent-bg text-ink'
      }`}>
        {body}
      </div>
    </div>
  )
}
