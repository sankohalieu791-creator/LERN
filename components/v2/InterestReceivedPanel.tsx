'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getOrgInterest, respondToInterest, getInterestMessages, sendInterestMessage, closeInterestThread,
  uploadInterestMessageFile, getSignedFileUrl,
} from '@/lib/supabase'
import { Check, Ban, Shield, Lock, Send, ArrowLeft, Plus, Paperclip, X } from 'lucide-react'

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
    // Was discarding the error and updating local state unconditionally
    // before -- a failed accept/decline still flipped the badge to
    // "Accepted"/"Declined" as if it had gone through, when the
    // employer's side never actually changed. This gates real contact
    // with an employer, so a false "accepted" is not a cosmetic bug.
    const { error } = await respondToInterest(id, status)
    if (error) return { error }
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    return { error: null }
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
                // .split(' ')[0] was being applied to the fallback
                // phrase too, truncating "A student" down to "A"
                // whenever student data was missing.
                const firstName = i.student?.full_name?.split(' ')[0] || 'A student'
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

function RequestThread({ item, onBack, onRespond }: { item: any; onBack: () => void; onRespond: (id: string, status: 'accepted' | 'declined') => Promise<{ error: any }> }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<any[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [attachFile, setAttachFile] = useState<File | null>(null)

  const load = () => { getInterestMessages(item.id).then(({ data }) => setMessages(data || [])) }
  useEffect(load, [item.id])

  const adult = isAdult(item.student?.date_of_birth)
  // Same fix as the list view above -- "This student" was being
  // truncated to a bare "This" whenever student data was missing,
  // exactly Michael's "placeholder text" finding.
  const firstName = item.student?.full_name?.split(' ')[0] || 'This student'

  const send = async (alsoAccept: boolean) => {
    if ((!reply.trim() && !attachFile) || !user) return
    setSending(true); setSendError('')
    if (alsoAccept && item.status === 'pending') {
      // Was pressing on to send the message even if the accept itself
      // failed -- the employer would then get a reply on a request that
      // your own side still shows as pending, never actually accepted.
      const { error } = await onRespond(item.id, 'accepted')
      if (error) { setSending(false); setSendError("Couldn't accept — try again."); return }
    }
    let attachment: { path: string; name: string; type: string; size: number } | undefined
    if (attachFile) {
      const { path, error: upErr } = await uploadInterestMessageFile(item.id, attachFile)
      if (upErr || !path) { setSending(false); setSendError("Couldn't attach that file — try again."); return }
      attachment = { path, name: attachFile.name, type: attachFile.type, size: attachFile.size }
    }
    const { error: sendErr } = await sendInterestMessage(item.id, user.id, 'org', reply.trim(), attachment)
    setSending(false)
    if (sendErr) { setSendError("Couldn't send — try again."); return }
    setReply(''); setAttachFile(null)
    await load()
  }

  const decline = async () => {
    setSendError('')
    const { error } = await onRespond(item.id, 'declined')
    // Was closing the thread even when the decline itself failed to
    // save -- the request would sit permanently un-respondable, still
    // "pending" underneath with no way back into it.
    if (error) { setSendError("Couldn't decline — try again."); return }
    await closeInterestThread(item.id)
  }

  return (
    // A real messaging app's composer is ALWAYS glued to the bottom of
    // the panel, whether the conversation is one message or fifty --
    // that only happens with a bounded-height flex column (header,
    // flex-1 scrolling messages, composer as the last child), not
    // "sticky", which has no effect once the whole thread is shorter
    // than the viewport (nothing to scroll, so nothing to stick) --
    // exactly why a short conversation left the composer stranded
    // wherever the last message happened to end, nowhere near the
    // bottom of the screen. Fixed full-screen on phone (same as every
    // other full-screen mobile view in this app); reverts to the plain
    // in-page card on desktop, where this was never the complaint.
    <div className="fixed inset-0 z-40 flex flex-col bg-paper lg:static lg:z-auto lg:flex lg:flex-col lg:bg-transparent">
      {/* Mobile: a sticky Gmail-style app bar. Desktop: the plain text link. */}
      <div className="flex-shrink-0 flex items-center gap-3 bg-paper border-b border-edge px-4 py-3 lg:hidden" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
        <button onClick={onBack} className="text-ink-secondary flex-shrink-0"><ArrowLeft className="w-5 h-5" /></button>
        <div className="min-w-0">
          <p className="font-bold text-ink text-[14px] truncate">{item.employer?.full_name || 'An employer'}</p>
          <p className="text-[12px] text-ink-tertiary truncate">Interested in {firstName}{item.opportunity_label ? ` · ${item.opportunity_label}` : ''}</p>
        </div>
      </div>
      <button onClick={onBack} className="hidden lg:flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-ink transition mb-4 flex-shrink-0">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to requests
      </button>

      <div className="flex-1 overflow-y-auto px-4 pt-4 lg:flex-none lg:overflow-visible lg:px-0 lg:pt-0">
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

        <div className="bg-transparent lg:bg-surface border-0 lg:border lg:border-edge rounded-xl lg:p-5 mb-4">
          <div className="hidden lg:flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-[12px]" style={{ backgroundColor: '#185FA5' }}>
              {initials(item.employer?.full_name)}
            </div>
            <div>
              <p className="font-bold text-ink text-[14px]">{item.employer?.full_name || 'An employer'}</p>
              <p className="text-[12px] text-ink-tertiary">Interested in {firstName}{item.opportunity_label ? ` · ${item.opportunity_label}` : ''}</p>
            </div>
          </div>

          <div className="space-y-3.5 lg:mt-4">
            {item.message && <ChatBubble fromEmployer message={{ body: item.message }} timestamp={item.created_at} isFirst />}
            {messages.map(m => <ChatBubble key={m.id} fromEmployer={m.sender_role === 'employer'} message={m} timestamp={m.created_at} />)}
          </div>
        </div>
      </div>

      {item.status !== 'declined' && (
        // WhatsApp/iMessage shape: one pill-shaped bar pinned to the
        // bottom, the "+" living inside it on the left rather than as
        // its own separate square button outside, a round send button
        // on the right. Replaces the old stacked textarea + a row of
        // two full-width buttons underneath, which read as a form, not
        // a conversation.
        <div className="flex-shrink-0 bg-paper lg:bg-transparent border-t border-edge lg:border-0 px-3 lg:px-0 py-2.5 lg:py-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.625rem)' }}>
          <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
            <p className="text-[11.5px] text-ink-quaternary leading-snug">
              {item.status === 'pending' ? 'Sending a reply also accepts this request. ' : ''}Never share personal contact details.
            </p>
            {item.status === 'pending' && (
              <button onClick={decline} className="flex items-center gap-1 text-[12px] font-semibold text-ink-tertiary hover:text-danger-text transition flex-shrink-0">
                <Ban className="w-3 h-3" /> Decline
              </button>
            )}
          </div>

          {attachFile && (
            <div className="flex items-center gap-2 bg-surface-subtle border border-edge rounded-lg px-3 py-2 mb-2 ml-1">
              <Paperclip className="w-3.5 h-3.5 text-ink-tertiary flex-shrink-0" />
              <span className="text-[12.5px] text-ink truncate flex-1">{attachFile.name}</span>
              <button onClick={() => setAttachFile(null)} aria-label="Remove attachment" className="text-ink-tertiary hover:text-danger-text transition flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 flex items-end gap-1 bg-surface-subtle border border-edge rounded-[22px] pl-1.5 pr-1.5 py-1.5 focus-within:border-brand transition">
              <label className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-ink-tertiary hover:text-brand hover:bg-surface transition cursor-pointer" aria-label="Attach a file">
                <Plus className="w-[18px] h-[18px]" />
                <input
                  type="file" className="hidden"
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={e => setAttachFile(e.target.files?.[0] || null)}
                />
              </label>
              <textarea
                value={reply} onChange={e => setReply(e.target.value)}
                placeholder="Message…"
                rows={1}
                className="flex-1 bg-transparent text-[14px] text-ink placeholder-ink-quaternary outline-none resize-none py-1.5 max-h-28"
              />
            </div>
            <button
              onClick={() => send(item.status === 'pending')}
              disabled={sending || (!reply.trim() && !attachFile)}
              aria-label={item.status === 'pending' ? 'Accept and reply' : 'Send'}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand-hover transition disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          {sendError && <p className="text-[12px] text-danger-text mt-2 ml-1">{sendError}</p>}
        </div>
      )}

      <p className="hidden lg:flex items-center gap-1.5 text-[12px] text-ink-quaternary">
        <Lock className="w-3 h-3" /> Logged for safeguarding
      </p>
    </div>
  )
}

function messageTime(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// No timestamp anywhere in this thread before -- every message just sat
// in a plain stack with nothing to say when any of it actually
// happened, which is exactly what made a back-and-forth conversation
// read as flat rather than like a real chat thread. isFirst gets its
// own small label since it's really the original request, not a reply.
function ChatBubble({ fromEmployer, message, timestamp, isFirst }: { fromEmployer: boolean; message: { body?: string; file_path?: string; file_name?: string; file_type?: string }; timestamp?: string; isFirst?: boolean }) {
  return (
    <div className={`flex flex-col ${fromEmployer ? 'items-start' : 'items-end'}`}>
      {isFirst && <p className="text-[11px] font-semibold text-ink-quaternary uppercase tracking-wide mb-1 px-1">Original request</p>}
      <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
        fromEmployer ? 'bg-surface-muted text-ink-secondary' : 'bg-accent-bg text-ink'
      }`}>
        {message.body && <p className={message.file_path ? 'mb-2' : ''}>{message.body}</p>}
        {message.file_path && <MessageAttachment path={message.file_path} name={message.file_name} type={message.file_type} />}
      </div>
      {timestamp && <p className="text-[11px] text-ink-quaternary mt-1 px-1">{messageTime(timestamp)}</p>}
    </div>
  )
}

// A document opens in a new tab (the browser's own PDF/Office viewer);
// an image/video gets a real inline preview instead of forcing a
// download just to see what was sent.
function MessageAttachment({ path, name, type }: { path: string; name?: string; type?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { getSignedFileUrl('interest-message-files', path).then(({ url }) => setUrl(url)) }, [path])
  const isImage = type?.startsWith('image/')
  const isVideo = type?.startsWith('video/')

  if (!url) return <p className="text-[12px] text-ink-tertiary">Loading attachment…</p>
  if (isImage) return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={name || 'Attachment'} className="rounded-lg max-h-48 max-w-full object-cover" /></a>
  if (isVideo) return <video src={url} controls className="rounded-lg max-h-48 max-w-full" />
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12.5px] font-semibold underline">
      <Paperclip className="w-3.5 h-3.5 flex-shrink-0" /> {name || 'Attachment'}
    </a>
  )
}
