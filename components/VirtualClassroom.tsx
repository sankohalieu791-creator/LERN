'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Mic, MicOff,
  Hand, X, Users, MoreVertical, Send, Loader2, WifiOff,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import type {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface VirtualClassroomProps {
  courseTitle:     string
  instructorName:  string
  channelName:     string
  isOpen:          boolean
  onClose:         () => void
}

interface Participant {
  userId:     string
  username:   string
  avatar_url: string | null
  handUp:     boolean
  isSelf:     boolean
}

interface ChatMessage {
  id:         string
  userId:     string
  username:   string
  text:       string
  instructor: boolean
}

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!

const AVATAR_COLORS = [
  'from-red-500 to-orange-500',
  'from-blue-500 to-purple-500',
  'from-green-500 to-teal-500',
  'from-yellow-500 to-orange-500',
  'from-pink-500 to-rose-500',
]

function Avatar({ name, avatarUrl, size = 48, colorIndex = 0 }: { name: string; avatarUrl?: string | null; size?: number; colorIndex?: number }) {
  if (avatarUrl) {
    return <img src={avatarUrl} className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <div
      className={`rounded-full bg-gradient-to-br ${AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export default function VirtualClassroom({
  courseTitle, instructorName, channelName, isOpen, onClose,
}: VirtualClassroomProps) {
  const { user } = useAuth()

  // ── Agora refs ────────────────────────────────────────────
  const clientRef        = useRef<IAgoraRTCClient | null>(null)
  const localAudioRef    = useRef<IMicrophoneAudioTrack | null>(null)
  const remoteVideoElRef = useRef<HTMLDivElement>(null)
  const realtimeRef      = useRef<RealtimeChannel | null>(null)
  const chatRef          = useRef<HTMLDivElement>(null)

  // ── Agora state ───────────────────────────────────────────
  const [joined,      setJoined]      = useState(false)
  const [connecting,  setConnecting]  = useState(false)
  const [muted,       setMuted]       = useState(true)
  const [handUp,      setHandUp]      = useState(false)
  const [rtcError,    setRtcError]    = useState('')
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([])

  // ── Presence + chat ───────────────────────────────────────
  const [participants, setParticipants] = useState<Participant[]>([])
  const [messages,     setMessages]     = useState<ChatMessage[]>([
    {
      id: '0', userId: 'system', username: instructorName,
      text: "Welcome — we'll start in a moment.", instructor: true,
    },
  ])
  const [chatInput, setChatInput] = useState('')

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  // ── Supabase Realtime presence + broadcast ────────────────
  useEffect(() => {
    if (!isOpen || !user) return

    const myUsername   = (user as any).username  ?? 'Participant'
    const myAvatarUrl  = (user as any).avatar_url ?? null
    const myUserId     = user.id

    const channel = supabase.channel(`classroom:${channelName}`, {
      config: { presence: { key: myUserId } },
    })
    realtimeRef.current = channel

    // ── Presence sync → update participants list ──────────
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ username: string; avatar_url: string | null; handUp: boolean }>()
      const list: Participant[] = Object.entries(state).flatMap(([uid, presences]) =>
        presences.map(p => ({
          userId:     uid,
          username:   p.username,
          avatar_url: p.avatar_url,
          handUp:     p.handUp ?? false,
          isSelf:     uid === myUserId,
        }))
      )
      setParticipants(list)
    })

    // ── Broadcast → receive chat messages ─────────────────
    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      setMessages(prev => {
        if (prev.find(m => m.id === payload.id)) return prev
        return [...prev, payload as ChatMessage]
      })
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ username: myUsername, avatar_url: myAvatarUrl, handUp: false })
      }
    })

    return () => {
      channel.unsubscribe()
      realtimeRef.current = null
    }
  }, [isOpen, user, channelName])

  // ── Update presence when hand changes ────────────────────
  useEffect(() => {
    if (!realtimeRef.current || !user) return
    const myUsername  = (user as any).username  ?? 'Participant'
    const myAvatarUrl = (user as any).avatar_url ?? null
    realtimeRef.current.track({ username: myUsername, avatar_url: myAvatarUrl, handUp })
  }, [handUp, user])

  // ── Join Agora channel ────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    const join = async () => {
      setConnecting(true)
      setRtcError('')
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
        AgoraRTC.setLogLevel(3)

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
        if (cancelled) return
        clientRef.current = client

        client.on('user-published', async (remoteUser, mediaType) => {
          await client.subscribe(remoteUser, mediaType)
          if (mediaType === 'video' && remoteVideoElRef.current) {
            remoteUser.videoTrack?.play(remoteVideoElRef.current)
          }
          if (mediaType === 'audio') remoteUser.audioTrack?.play()
          setRemoteUsers(prev =>
            prev.find(u => u.uid === remoteUser.uid) ? prev : [...prev, remoteUser]
          )
        })

        client.on('user-unpublished', (remoteUser, mediaType) => {
          if (mediaType === 'video') remoteUser.videoTrack?.stop()
        })

        client.on('user-left', (remoteUser) => {
          setRemoteUsers(prev => prev.filter(u => u.uid !== remoteUser.uid))
        })

        await client.join(APP_ID, channelName, null, null)
        if (!cancelled) { setJoined(true); setConnecting(false) }
      } catch (err: any) {
        if (!cancelled) { setRtcError(err.message || 'Could not connect'); setConnecting(false) }
      }
    }

    join()
    return () => { cancelled = true }
  }, [isOpen, channelName])

  // ── Cleanup ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      localAudioRef.current?.close()
      clientRef.current?.leave().catch(() => {})
    }
  }, [])

  const leaveAndClose = useCallback(async () => {
    localAudioRef.current?.close()
    localAudioRef.current = null
    try { await clientRef.current?.leave() } catch {}
    clientRef.current = null
    setJoined(false); setRemoteUsers([]); setMuted(true); setRtcError('')
    onClose()
  }, [onClose])

  const toggleMic = async () => {
    if (!joined || !clientRef.current) return
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      if (muted) {
        const audio = await AgoraRTC.createMicrophoneAudioTrack()
        localAudioRef.current = audio
        await clientRef.current.publish([audio])
        setMuted(false)
      } else {
        if (localAudioRef.current) {
          await clientRef.current.unpublish([localAudioRef.current])
          localAudioRef.current.close()
          localAudioRef.current = null
        }
        setMuted(true)
      }
    } catch { setRtcError('Microphone access denied.') }
  }

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !user) return
    const msg: ChatMessage = {
      id:         String(Date.now()),
      userId:     user.id,
      username:   (user as any).username ?? 'You',
      text:       chatInput.trim(),
      instructor: (user as any).username === instructorName,
    }
    setMessages(prev => [...prev, msg])
    realtimeRef.current?.send({ type: 'broadcast', event: 'chat', payload: msg })
    setChatInput('')
  }

  if (!isOpen) return null

  const hasRemoteVideo = remoteUsers.some(u => u.videoTrack)
  const userCount = participants.length || 1

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* ── HEADER ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button onClick={leaveAndClose} className="w-9 h-9 bg-[#1e1e1e] rounded-full flex items-center justify-center">
          <X className="w-4 h-4 text-white" />
        </button>
        <div className="text-center flex-1 px-3">
          <p className="text-[#555] text-[9px] font-bold uppercase tracking-widest">
            {connecting ? 'Connecting…' : joined ? '🔴 Virtual Classroom' : 'Virtual Classroom'}
          </p>
          <p className="text-white text-xs font-bold mt-0.5 line-clamp-1">{courseTitle}</p>
        </div>
        <button className="w-9 h-9 bg-[#1e1e1e] rounded-full flex items-center justify-center">
          <MoreVertical className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* ── ERROR BANNER ──────────────────────────────────── */}
      {rtcError && (
        <div className="mx-4 mb-2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 flex-shrink-0">
          <WifiOff className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-xs flex-1">{rtcError}</p>
          <button onClick={() => setRtcError('')} className="text-red-400 text-xs font-bold">✕</button>
        </div>
      )}

      {/* ── SCROLLABLE BODY ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">

        {/* MAIN VIDEO AREA */}
        <div className="mx-4 rounded-2xl overflow-hidden aspect-video bg-[#1a1a1a] relative mb-4">
          <div ref={remoteVideoElRef} className="w-full h-full" />

          {connecting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111] gap-3">
              <Loader2 className="w-8 h-8 text-[#444] animate-spin" />
              <p className="text-[#555] text-sm">Joining classroom…</p>
            </div>
          )}

          {!connecting && joined && !hasRemoteVideo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] gap-2">
              <Avatar name={instructorName} size={64} colorIndex={0} />
              <p className="text-white text-sm font-semibold mt-1">{instructorName}</p>
              <p className="text-[#555] text-xs">Waiting for instructor to go live…</p>
            </div>
          )}

          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1">
            <Users className="w-3 h-3 text-white" />
            <span className="text-white text-xs font-bold">{userCount}</span>
          </div>

          {!connecting && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/70 rounded-full px-3 py-1.5">
              <Avatar name={instructorName} size={20} colorIndex={0} />
              <span className="text-white text-xs font-semibold">{instructorName}</span>
              {joined && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
            </div>
          )}
        </div>

        {/* IN THE ROOM */}
        {participants.length > 0 && (
          <div className="px-4 mb-4">
            <p className="text-white text-xs font-bold uppercase tracking-wide mb-3">
              In the Room · {userCount}
            </p>
            <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {participants.map((p, i) => (
                <div key={p.userId} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="relative">
                    <Avatar name={p.username} avatarUrl={p.avatar_url} size={48} colorIndex={i} />
                    {p.handUp && (
                      <span className="absolute -top-1 -right-1 text-sm">✋</span>
                    )}
                  </div>
                  <p className="text-[#888] text-[10px] max-w-[52px] truncate text-center">
                    {p.isSelf ? 'You' : p.username.split(' ')[0]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHAT */}
        <div ref={chatRef} className="px-4 space-y-3 mb-4">
          {messages.map(m => (
            <div key={m.id}>
              <p className={`text-xs font-bold mb-0.5 ${m.instructor ? 'text-[#FF6B2B]' : 'text-[#1d9bf0]'}`}>
                {m.username}
              </p>
              <p className="text-white text-sm">{m.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTROLS ──────────────────────────────────────── */}
      <div className="px-4 py-3 bg-[#111] border-t border-[rgba(255,255,255,0.06)] flex-shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <div className="flex items-center gap-3 mb-3">

          <button onClick={toggleMic} disabled={!joined}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition disabled:opacity-40 ${muted ? 'bg-[#333] text-white' : 'bg-[#FF6B2B] text-white'}`}>
            {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button onClick={() => setHandUp(v => !v)}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition ${handUp ? 'bg-[#FF6B2B] text-white' : 'bg-[#333] text-white'}`}>
            <Hand className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <button onClick={leaveAndClose}
            className="bg-red-500 text-white font-bold px-5 py-2.5 rounded-full text-sm hover:bg-red-600 transition">
            Leave
          </button>
        </div>

        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Say something to the class…"
            className="flex-1 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-full px-4 py-2.5 text-white text-sm placeholder-[#444] outline-none"
          />
          <button type="submit" disabled={!chatInput.trim()}
            className="w-9 h-9 bg-white rounded-full flex items-center justify-center disabled:opacity-30 flex-shrink-0">
            <Send className="w-4 h-4 text-black" />
          </button>
        </form>
      </div>
    </div>
  )
}
