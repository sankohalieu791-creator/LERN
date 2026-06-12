'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getMessages, sendMessage, markMessagesRead, deleteMessage, supabase } from '@/lib/supabase'
import { sendPush } from '@/lib/push'
import { ArrowLeft, Send, Loader2, Copy, Trash2, Check } from 'lucide-react'

interface CtxMenu {
  msg: any
  x: number
  y: number
}

export default function ConversationPage() {
  const { conversationId } = useParams()
  const { user } = useAuth()
  const router = useRouter()
  const convId = conversationId as string

  const [messages,   setMessages]   = useState<any[]>([])
  const [otherUser,  setOtherUser]  = useState<any>(null)
  const [text,       setText]       = useState('')
  const [sending,    setSending]    = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [ctxMenu,    setCtxMenu]    = useState<CtxMenu | null>(null)
  const [copied,     setCopied]     = useState(false)

  const bottomRef      = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user || !convId) return
    const load = async () => {
      setLoading(true)
      const { data } = await getMessages(convId)
      setMessages(data || [])
      const { data: conv } = await supabase.from('conversations').select('*').eq('id', convId).single()
      if (conv) {
        const otherId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id
        const { data: u } = await supabase.from('users').select('id, username, avatar_url, verified').eq('id', otherId).single()
        setOtherUser(u)
      }
      await markMessagesRead(convId, user.id)
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`messages:${convId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        async (payload) => {
          const newMsg = payload.new as any
          const { data: senderData } = await supabase.from('users').select('id, username, avatar_url').eq('id', newMsg.sender_id).single()
          setMessages(prev => [...prev, { ...newMsg, sender: senderData }])
          if (newMsg.sender_id !== user.id) await markMessagesRead(convId, user.id)
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id))
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [convId, user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!user || !text.trim() || sending) return
    const content = text.trim()
    setText('')
    setSending(true)
    await sendMessage(convId, user.id, content)
    setSending(false)
    inputRef.current?.focus()
    if (otherUser?.id) {
      sendPush(
        otherUser.id,
        `💬 ${(user as any).username ?? 'Someone'}`,
        content.slice(0, 100),
        `/messages/${convId}`
      )
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // Long press handlers
  const startLongPress = useCallback((e: React.TouchEvent, msg: any) => {
    const touch = e.touches[0]
    const x = touch.clientX
    const y = touch.clientY
    longPressTimer.current = setTimeout(() => {
      setCtxMenu({ msg, x, y })
    }, 480)
  }, [])

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleCopy = async () => {
    if (!ctxMenu) return
    try { await navigator.clipboard.writeText(ctxMenu.msg.content) } catch {}
    setCopied(true)
    setTimeout(() => { setCopied(false); setCtxMenu(null) }, 900)
  }

  const handleDeleteMsg = async () => {
    if (!ctxMenu) return
    const msgId = ctxMenu.msg.id
    setCtxMenu(null)
    setMessages(prev => prev.filter(m => m.id !== msgId))
    await deleteMessage(msgId)
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDateSep(dateStr: string) {
    const d    = new Date(dateStr)
    const today = new Date()
    const diff  = Math.floor((today.getTime() - d.getTime()) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const grouped: { date: string; msgs: any[] }[] = []
  for (const m of messages) {
    const day  = new Date(m.created_at).toDateString()
    const last = grouped[grouped.length - 1]
    if (last && last.date === day) last.msgs.push(m)
    else grouped.push({ date: day, msgs: [m] })
  }

  const initial = otherUser?.username?.[0]?.toUpperCase() ?? '?'

  // Position the context menu so it stays on screen
  const menuY = ctxMenu
    ? Math.min(ctxMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 130)
    : 0
  const menuX = ctxMenu
    ? Math.max(16, Math.min(ctxMenu.x - 90, (typeof window !== 'undefined' ? window.innerWidth : 400) - 196))
    : 0

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.07)] flex-shrink-0 bg-[#0f0f0f]">
        <button onClick={() => router.back()} className="text-white p-1 -ml-1 flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
          {otherUser?.avatar_url
            ? <img src={otherUser.avatar_url} alt={otherUser.username} className="w-full h-full object-cover" />
            : initial}
        </div>
        <p className="text-white font-bold text-base flex-1 truncate">{otherUser?.username ?? '…'}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" onClick={() => setCtxMenu(null)}>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <p className="text-[#444] text-sm">No messages yet</p>
            <p className="text-[#333] text-xs mt-1">Say hello!</p>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.date}>
              <div className="flex justify-center my-4">
                <span className="text-[#444] text-xs bg-[#1a1a1a] px-3 py-1 rounded-full">
                  {formatDateSep(group.msgs[0].created_at)}
                </span>
              </div>
              {group.msgs.map((m: any, i: number) => {
                const isMe     = m.sender_id === user?.id
                const showAvatar = !isMe && (i === 0 || group.msgs[i - 1]?.sender_id !== m.sender_id)
                return (
                  <div key={m.id}
                    className={`flex items-end gap-2 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}
                    onTouchStart={e => startLongPress(e, m)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onContextMenu={e => { e.preventDefault(); setCtxMenu({ msg: m, x: e.clientX, y: e.clientY }) }}
                  >
                    {!isMe && (
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-[10px] font-bold overflow-hidden flex-shrink-0 ${showAvatar ? 'visible' : 'invisible'}`}>
                        {m.sender?.avatar_url
                          ? <img src={m.sender.avatar_url} className="w-full h-full object-cover" />
                          : m.sender?.username?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed select-none ${
                        isMe
                          ? 'bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white rounded-br-sm'
                          : 'bg-[#1e1e1e] text-white rounded-bl-sm'
                      }`}>
                        {m.content}
                      </div>
                      <p className="text-[#333] text-[10px] mt-0.5 px-1">{formatTime(m.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex-shrink-0 px-4 py-3 border-t border-[rgba(255,255,255,0.07)] bg-[#0f0f0f] flex items-center gap-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          className="flex-1 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-full px-4 py-3 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="w-10 h-10 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition"
        >
          {sending
            ? <Loader2 className="w-4 h-4 text-white animate-spin" />
            : <Send className="w-4 h-4 text-white" />}
        </button>
      </div>

      {/* Long-press / right-click context menu */}
      {ctxMenu && (
        <div className="fixed inset-0 z-[80]" onTouchStart={() => setCtxMenu(null)} onClick={() => setCtxMenu(null)}>
          <div
            className="absolute bg-[#1e1e1e] border border-[rgba(255,255,255,0.1)] rounded-2xl overflow-hidden shadow-2xl min-w-[180px]"
            style={{ top: menuY, left: menuX }}
            onClick={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
          >
            <button
              onClick={handleCopy}
              className="flex items-center gap-3 w-full px-4 py-3.5 text-white text-sm active:bg-[#2a2a2a] transition"
            >
              {copied
                ? <Check className="w-4 h-4 text-green-400" />
                : <Copy className="w-4 h-4 text-[#888]" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {ctxMenu.msg.sender_id === user?.id && (
              <>
                <div className="h-px bg-[rgba(255,255,255,0.07)]" />
                <button
                  onClick={handleDeleteMsg}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-red-400 text-sm active:bg-[#2a2a2a] transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete message
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
