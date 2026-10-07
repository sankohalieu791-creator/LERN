'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Send } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useResolvedTheme } from '@/context/ThemeProvider'
import { Spinner } from '@/components/v2/Field'
import { getGroups, createWorkItem } from '@/lib/supabase'
import type { Group } from '@/lib/types'
import { searchHelp, starterTopics } from '@/lib/helpDeskSearch'
import type { HelpRole } from '@/lib/helpDeskContent'
import { askHelpDeskAI, looksLikeAction, type AIBriefFields, type AIWorkshopFields } from '@/lib/helpDeskAI'

type ProposalDraft =
  | { kind: 'brief'; fields: AIBriefFields }
  | { kind: 'workshop'; fields: AIWorkshopFields }

type Msg = {
  id: number
  from: 'me' | 'desk'
  text?: string
  thinking?: boolean
  proposal?: ProposalDraft
  proposalStatus?: 'draft' | 'creating' | 'created' | 'error'
  proposalError?: string
}

const FALLBACK = "I don't have a clear answer for that yet — try rephrasing, or pick one of the topics below."

// The orb's two dashes, standing in for an "ask an AI" icon without
// actually being one for the written-answer path -- see
// lib/helpDeskContent.ts for that distinction, and askHelpDeskAI for
// the one path (drafting a brief/workshop) that genuinely is AI.
function OrbFace({ size = 8 }: { size?: number }) {
  return (
    <span className="flex items-center" style={{ gap: Math.max(2, size * 0.3) }}>
      <span className="rounded-full" style={{ width: Math.max(2, size * 0.3), height: size, backgroundColor: '#2b2622' }} />
      <span className="rounded-full" style={{ width: Math.max(2, size * 0.3), height: size, backgroundColor: '#2b2622' }} />
    </span>
  )
}

function resolveGroupId(groups: Group[], name?: string): string {
  if (!name) return ''
  return groups.find(g => g.name.toLowerCase() === name.trim().toLowerCase())?.id || ''
}

// The one place a proposal from the AI becomes a decision a human has
// to actually make -- every field here is editable, nothing is sent
// to Supabase until "Create" is tapped, and that write calls the
// exact same createWorkItem the manual form uses, so it is bound by
// the same RLS and shows up identically in Briefs/Workshops.
function ProposalCard({
  msg, groups, organisationId, userId, onUpdate, onResolved,
}: {
  msg: Msg
  groups: Group[]
  organisationId: string
  userId: string
  onUpdate: (patch: Partial<Msg>) => void
  onResolved: (text: string) => void
}) {
  const proposal = msg.proposal!
  const [title, setTitle] = useState(proposal.fields.title || '')
  const [topic, setTopic] = useState(proposal.fields.topic || '')
  const [criteria, setCriteria] = useState(proposal.fields.criteria || '')
  const [deadline, setDeadline] = useState(proposal.fields.deadline || '')
  const [groupId, setGroupId] = useState(() => resolveGroupId(groups, proposal.fields.group_name))
  const [assignment, setAssignment] = useState(proposal.kind === 'brief' ? proposal.fields.assignment : '')
  const [description, setDescription] = useState(proposal.kind === 'workshop' ? (proposal.fields.description || '') : '')
  const [mode, setMode] = useState<'online' | 'in_person'>(proposal.kind === 'workshop' ? proposal.fields.mode : 'online')
  const [location, setLocation] = useState(proposal.kind === 'workshop' ? (proposal.fields.location || '') : '')
  const [startsAt, setStartsAt] = useState(proposal.kind === 'workshop' && proposal.fields.starts_at ? proposal.fields.starts_at.slice(0, 16) : '')

  const busy = msg.proposalStatus === 'creating'
  const inputCls = "w-full bg-surface border border-edge rounded-lg px-2.5 py-1.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"

  const create = async () => {
    if (!title.trim() || !criteria.trim() || (proposal.kind === 'brief' && !assignment.trim())) {
      onUpdate({ proposalStatus: 'error', proposalError: 'Title, criteria, and what to do are all required.' }); return
    }
    if (proposal.kind === 'workshop' && mode === 'in_person' && !location.trim()) {
      onUpdate({ proposalStatus: 'error', proposalError: 'Add a location for an in-person workshop.' }); return
    }
    onUpdate({ proposalStatus: 'creating', proposalError: undefined })
    const { data, error } = await createWorkItem(organisationId, userId, proposal.kind === 'brief' ? {
      type: 'brief', title: title.trim(), topic: topic.trim() || undefined, assignment: assignment.trim(),
      criteria: criteria.trim(), deadline: deadline || null, group_id: groupId || null, visibility: 'public',
    } : {
      type: 'workshop', title: title.trim(), topic: topic.trim() || undefined, description: description.trim() || undefined,
      criteria: criteria.trim(), deadline: deadline || null, group_id: groupId || null, visibility: 'public',
      mode, location: mode === 'in_person' ? location.trim() : undefined,
      starts_at: mode === 'online' && startsAt ? new Date(startsAt).toISOString() : null,
    })
    if (error || !data) { onUpdate({ proposalStatus: 'error', proposalError: error?.message || 'Could not create it.' }); return }
    onUpdate({ proposalStatus: 'created' })
    onResolved(`✓ ${proposal.kind === 'brief' ? 'Brief' : 'Workshop'} created — "${title.trim()}" is live.`)
  }

  if (msg.proposalStatus === 'created') return null

  return (
    <div
      className="rounded-xl p-3 text-[13px] text-ink border space-y-2.5 w-full max-w-[85%]"
      style={{ backgroundColor: 'color-mix(in srgb, var(--surface-subtle) 92%, transparent)', borderColor: 'color-mix(in srgb, var(--border-subtle) 80%, transparent)' }}
    >
      <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">
        Draft {proposal.kind === 'brief' ? 'brief' : 'workshop'} — review before creating
      </p>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className={inputCls} />
      <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic (optional)" className={inputCls} />
      {proposal.kind === 'brief' ? (
        <textarea value={assignment} onChange={e => setAssignment(e.target.value)} placeholder="What the student has to do" rows={3} className={`${inputCls} resize-none`} />
      ) : (
        <>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className={`${inputCls} resize-none`} />
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setMode('online')} className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition ${mode === 'online' ? 'bg-brand text-white' : 'bg-surface border border-edge text-ink-secondary'}`}>Online</button>
            <button type="button" onClick={() => setMode('in_person')} className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition ${mode === 'in_person' ? 'bg-brand text-white' : 'bg-surface border border-edge text-ink-secondary'}`}>In person</button>
          </div>
          {mode === 'in_person' ? (
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" className={inputCls} />
          ) : (
            <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} className={inputCls} />
          )}
        </>
      )}
      <textarea value={criteria} onChange={e => setCriteria(e.target.value)} placeholder="Criteria, one per line" rows={3} className={`${inputCls} resize-none`} />
      <div className="flex gap-2">
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />
        <select value={groupId} onChange={e => setGroupId(e.target.value)} className={inputCls}>
          <option value="">Whole org</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      {msg.proposalStatus === 'error' && <p className="text-[12px] font-semibold text-danger-text">{msg.proposalError}</p>}
      <button
        type="button" onClick={create} disabled={busy}
        className="w-full flex items-center justify-center gap-1.5 bg-brand text-white rounded-lg py-2 text-[13px] font-bold hover:bg-brand-hover transition disabled:opacity-50"
      >
        {busy && <Spinner />} Create {proposal.kind === 'brief' ? 'brief' : 'workshop'}
      </button>
    </div>
  )
}

// Staff-facing only (institution, provider, employer) -- built for "a
// teacher who isn't familiar with the technology" to ask a plain
// question and get a straight answer. A floating glass orb that opens
// into a draggable card (not a full-screen sheet) so it never has to
// fully block whatever page it was opened over. Most answers come
// from the hand-written knowledge base (see lib/helpDeskContent.ts);
// institution/provider staff asking it to *do* something -- "create a
// brief for..." -- get routed to a real AI instead (lib/helpDeskAI.ts)
// that can only draft, never create directly.
export default function HelpDesk() {
  const { user } = useAuth()
  const theme = useResolvedTheme()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [groups, setGroups] = useState<Group[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)
  const baseRectRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null)
  const draggingRef = useRef(false)
  const pointerOriginRef = useRef({ x: 0, y: 0 })
  const dragOriginRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    if (open && user?.organisation_id && groups.length === 0) {
      getGroups(user.organisation_id).then(({ data }) => setGroups(data || []))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.organisation_id])

  // Captures the panel's un-dragged position once it opens, so drag
  // moves can be clamped to the viewport without the panel ever being
  // draggable fully off-screen.
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => {
        if (panelRef.current) {
          const r = panelRef.current.getBoundingClientRect()
          baseRectRef.current = { left: r.left - drag.x, top: r.top - drag.y, width: r.width, height: r.height }
        }
      })
      return () => cancelAnimationFrame(raf)
    }
    baseRectRef.current = null
    setDrag({ x: 0, y: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onDragStart = (e: React.PointerEvent) => {
    draggingRef.current = true
    dragOriginRef.current = { ...drag }
    pointerOriginRef.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onDragMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    let nx = dragOriginRef.current.x + (e.clientX - pointerOriginRef.current.x)
    let ny = dragOriginRef.current.y + (e.clientY - pointerOriginRef.current.y)
    const base = baseRectRef.current
    if (base) {
      const margin = 10
      nx = Math.min(Math.max(nx, margin - base.left), window.innerWidth - margin - base.width - base.left)
      ny = Math.min(Math.max(ny, margin - base.top), window.innerHeight - margin - base.height - base.top)
    }
    setDrag({ x: nx, y: ny })
  }
  const onDragEnd = () => { draggingRef.current = false }

  const role = user?.role as HelpRole | undefined
  const isStaff = role === 'institution_staff' || role === 'provider_staff' || role === 'employer'
  if (!isStaff) return null
  const safeRole = role as HelpRole
  const canAI = safeRole === 'institution_staff' || safeRole === 'provider_staff'

  const updateMsg = (id: number, patch: Partial<Msg>) => {
    setMessages(m => m.map(msg => (msg.id === id ? { ...msg, ...patch } : msg)))
  }

  const ask = async (q: string) => {
    if (!q.trim()) return
    const userId = ++idRef.current
    const deskId = ++idRef.current
    const historyForAI = messages.filter(m => m.text && !m.proposal).map(m => ({ role: m.from === 'me' ? ('user' as const) : ('assistant' as const), content: m.text! }))
    setMessages(m => [...m, { id: userId, from: 'me', text: q }, { id: deskId, from: 'desk', text: '', thinking: true }])
    setInput('')

    const isAction = canAI && looksLikeAction(q)
    const kbResults = isAction ? [] : searchHelp(q, safeRole)

    if (kbResults[0]) {
      const answer = kbResults[0].answer
      window.setTimeout(() => updateMsg(deskId, { text: answer, thinking: false }), 450 + Math.random() * 400)
      return
    }

    if (canAI) {
      const result = await askHelpDeskAI(q, historyForAI)
      if (result.type === 'proposal') {
        updateMsg(deskId, { text: undefined, thinking: false, proposal: { kind: result.kind, fields: result.fields } as ProposalDraft, proposalStatus: 'draft' })
      } else {
        updateMsg(deskId, { text: result.text, thinking: false })
      }
      return
    }

    window.setTimeout(() => updateMsg(deskId, { text: FALLBACK, thinking: false }), 450 + Math.random() * 400)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="LERN Help Desk"
        className="fixed left-5 z-40 w-14 h-14 active:scale-95 transition"
        style={{ bottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        <span
          className="absolute inset-0 rounded-full flex items-center justify-center border"
          style={{
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderColor: 'rgba(255,255,255,0.9)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          <OrbFace size={10} />
        </span>
      </button>
    )
  }

  const topics = starterTopics(safeRole)

  return createPortal(
    <div
      ref={panelRef}
      data-theme={theme}
      className="fixed z-40 flex flex-col rounded-2xl overflow-hidden"
      style={{
        left: '1.25rem',
        bottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
        width: 'min(340px, calc(100vw - 2rem))',
        height: 'min(480px, calc(100dvh - 6rem))',
        transform: `translate3d(${drag.x}px, ${drag.y}px, 0)`,
        backgroundColor: 'color-mix(in srgb, var(--surface) 72%, transparent)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        border: '1px solid color-mix(in srgb, var(--border) 55%, transparent)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      {/* Drag handle -- the only part that starts a drag, so the close
          button and header text stay ordinary click targets. touch-none
          so a finger drag here repositions the card instead of
          scrolling the page behind it. */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        className="flex-shrink-0 pt-2 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none"
      >
        <span className="w-9 h-1.5 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--ink) 25%, transparent)' }} />
      </div>

      <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border"
            style={{ background: 'rgba(255,255,255,0.75)', borderColor: 'rgba(255,255,255,0.9)' }}
          >
            <OrbFace size={8} />
          </span>
          <p className="font-bold text-ink text-[14px] leading-tight truncate">LERN Help Desk</p>
        </div>
        <button
          onClick={() => setOpen(false)} aria-label="Close"
          className="w-8 h-8 rounded-full flex items-center justify-center text-ink-tertiary hover:bg-surface-muted transition flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <>
            <p className="text-[13px] text-ink-secondary leading-relaxed">
              Ask how to do something on LERN and I'll walk you through it. Every answer here was written by the LERN team, not generated — if I don't know something, I'll say so rather than guess.
              {canAI && " Ask me to create a brief or schedule a workshop and I'll draft one for you to review."}
            </p>
            <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mt-4 mb-1.5">Try one of these</p>
            <div className="flex flex-col gap-1.5">
              {topics.map(t => (
                <button
                  key={t.id} onClick={() => ask(t.question)}
                  className="text-left text-[13px] font-medium text-ink bg-surface-subtle border border-edge-subtle rounded-lg px-3 py-2 hover:border-edge-input transition"
                >
                  {t.question}
                </button>
              ))}
            </div>
          </>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            {m.proposal ? (
              <ProposalCard
                msg={m} groups={groups}
                organisationId={user?.organisation_id || ''} userId={user?.id || ''}
                onUpdate={patch => updateMsg(m.id, patch)}
                onResolved={text => {
                  const resolvedId = ++idRef.current
                  setMessages(cur => [...cur, { id: resolvedId, from: 'desk', text }])
                }}
              />
            ) : (
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.from === 'me' ? 'bg-brand text-white rounded-br-sm' : 'text-ink rounded-bl-sm border'
                }`}
                style={m.from === 'desk' ? {
                  backgroundColor: 'color-mix(in srgb, var(--surface-subtle) 85%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
                } : undefined}
              >
                {m.thinking ? (
                  <span className="flex items-center gap-1 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: '120ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: '240ms' }} />
                  </span>
                ) : m.text}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex-shrink-0 border-t p-3" style={{ borderColor: 'color-mix(in srgb, var(--border) 55%, transparent)' }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }}
            placeholder="Ask a question…"
            rows={1}
            className="flex-1 bg-surface-subtle border border-edge rounded-xl px-3.5 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none resize-none max-h-24 focus:border-brand transition"
          />
          <button
            onClick={() => ask(input)}
            disabled={!input.trim()}
            aria-label="Ask"
            className="flex-shrink-0 w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand-hover transition disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
