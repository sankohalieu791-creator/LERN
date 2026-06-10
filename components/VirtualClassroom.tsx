'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Mic, MicOff, Video, VideoOff,
  Hand, X, Users, MoreVertical, Send, Loader2, WifiOff, UserX, VolumeX, Check, Bell,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { supabase } from '@/lib/supabase'
import type {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface VirtualClassroomProps {
  courseTitle:    string
  instructorName: string
  channelName:    string
  isInstructor:   boolean
  isOpen:         boolean
  onClose:        () => void
}

interface Participant {
  userId:     string
  username:   string
  avatar_url: string | null
  handUp:     boolean
  status:     'waiting' | 'joined' | 'instructor'
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

function Avatar({ name, avatarUrl, size = 48, colorIndex = 0 }: {
  name: string
  avatarUrl?: string | null
  size?: number
  colorIndex?: number
}) {
  if (avatarUrl) {
    return <img src={avatarUrl} className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <div
      className={`rounded-full bg-gradient-to-br ${AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export default function VirtualClassroom({
  courseTitle, instructorName, channelName, isInstructor, isOpen, onClose,
}: VirtualClassroomProps) {
  const { user } = useAuth()
  const { t } = useLanguage()

  // ── Agora refs ────────────────────────────────────────────
  const clientRef        = useRef<IAgoraRTCClient | null>(null)
  const localAudioRef    = useRef<IMicrophoneAudioTrack | null>(null)
  const localCameraRef   = useRef<ICameraVideoTrack | null>(null)
  const mainVideoRef     = useRef<HTMLDivElement>(null)   // remote video OR instructor self-cam
  const realtimeRef      = useRef<RealtimeChannel | null>(null)
  const chatRef          = useRef<HTMLDivElement>(null)

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // ── Agora state ───────────────────────────────────────────
  const [joined,      setJoined]      = useState(false)
  const [connecting,  setConnecting]  = useState(false)
  const [muted,       setMuted]       = useState(true)
  const [cameraOn,    setCameraOn]    = useState(false)
  const [handUp,      setHandUp]      = useState(false)
  const [rtcError,    setRtcError]    = useState('')
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([])

  // ── Waiting room state ────────────────────────────────────
  const [waitingForApproval, setWaitingForApproval] = useState(false)
  const [denied,             setDenied]             = useState(false)
  const [admitted,           setAdmitted]           = useState(isInstructor)
  const [showDotPanel,       setShowDotPanel]        = useState(false)
  const [acceptedIds,        setAcceptedIds]        = useState<Set<string>>(new Set())

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

  // ── Leave and close ───────────────────────────────────────
  const leaveAndClose = useCallback(async () => {
    localAudioRef.current?.close()
    localAudioRef.current = null
    if (localCameraRef.current) {
      localCameraRef.current.stop()
      localCameraRef.current.close()
      localCameraRef.current = null
    }
    try { await clientRef.current?.leave() } catch {}
    clientRef.current = null
    setJoined(false); setRemoteUsers([]); setMuted(true); setCameraOn(false); setRtcError('')
    setWaitingForApproval(false); setDenied(false); setShowDotPanel(false); setAdmitted(false)
    onCloseRef.current()
  }, [])

  // ── Join Agora RTC ────────────────────────────────────────
  const joinAgoraRTC = useCallback(async () => {
    if (clientRef.current) return
    setConnecting(true)
    setRtcError('')

    let token: string | null = null
    try {
      const res = await fetch(`/api/agora-token?channel=${encodeURIComponent(channelName)}&uid=0`)
      if (res.ok) {
        const data = await res.json()
        token = data.token ?? null
      }
    } catch {}
    if (!token) {
      token = process.env.NEXT_PUBLIC_AGORA_TEMP_TOKEN ?? null
    }

    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      AgoraRTC.setLogLevel(1)
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })

      client.on('user-published', async (remoteUser, mediaType) => {
        await client.subscribe(remoteUser, mediaType)
        if (mediaType === 'video' && mainVideoRef.current) {
          remoteUser.videoTrack?.play(mainVideoRef.current)
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

      clientRef.current = client
      await client.join(APP_ID, channelName, token, null)
      setJoined(true)
      setConnecting(false)
    } catch (err: any) {
      try { await clientRef.current?.leave() } catch {}
      clientRef.current = null
      const code:   string = (err?.code    ?? '').toUpperCase()
      const errMsg: string = (err?.message ?? err?.msg ?? '').toLowerCase()
      const isStaticKey =
        code === 'DYNAMIC_USE_STATIC_KEY' ||
        code === 'CAN_NOT_GATEWAY_SERVER' ||
        errMsg.includes('static key') ||
        errMsg.includes('dynamic use static') ||
        errMsg.includes('invalid vendor key')
      const msg = isStaticKey
        ? 'Classroom needs a token — go to Vercel → Settings → Environment Variables and add AGORA_APP_CERTIFICATE (copy the Primary Certificate from your Agora Console project).'
        : code === 'INVALID_TOKEN' || errMsg.includes('invalid token')
        ? 'Agora token is invalid — regenerate it in Agora Console and update AGORA_APP_CERTIFICATE in Vercel.'
        : code === 'TOKEN_EXPIRED' || errMsg.includes('token expired')
        ? 'Agora token expired — update AGORA_APP_CERTIFICATE in Vercel env vars.'
        : err.message || 'Could not connect to classroom'
      setRtcError(msg)
      setConnecting(false)
    }
  }, [channelName])

  // ── Supabase Realtime ─────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !user) return

    const myUsername  = (user as any).username  ?? 'Participant'
    const myAvatarUrl = (user as any).avatar_url ?? null
    const myUserId    = user.id
    const myStatus    = isInstructor ? 'instructor' : 'waiting'

    const channel = supabase.channel(`classroom:${channelName}`, {
      config: { presence: { key: myUserId } },
    })
    realtimeRef.current = channel

    // Rebuild participant list from full presence state — called on sync, join, AND leave
    // so raised hands and new joiners appear instantly without waiting for the next sync cycle
    const rebuildParticipants = () => {
      const state = channel.presenceState<{
        username: string
        avatar_url: string | null
        handUp: boolean
        status: 'waiting' | 'joined' | 'instructor'
      }>()
      const list: Participant[] = Object.entries(state).map(([uid, presences]) => ({
        userId:     uid,
        username:   presences[0].username,
        avatar_url: presences[0].avatar_url,
        handUp:     presences[0].handUp ?? false,
        status:     presences[0].status ?? 'waiting',
        isSelf:     uid === myUserId,
      }))
      setParticipants(list)
    }

    channel.on('presence', { event: 'sync' },  rebuildParticipants)
    channel.on('presence', { event: 'join' },  rebuildParticipants)
    channel.on('presence', { event: 'leave' }, rebuildParticipants)

    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      setMessages(prev => {
        if (prev.find(m => m.id === payload.id)) return prev
        return [...prev, payload as ChatMessage]
      })
    })

    channel.on('broadcast', { event: 'kick' }, ({ payload }) => {
      if (payload.targetUserId === myUserId) leaveAndClose()
    })

    channel.on('broadcast', { event: 'mute' }, ({ payload }) => {
      if (payload.targetUserId === myUserId) {
        localAudioRef.current?.close()
        localAudioRef.current = null
        setMuted(true)
      }
    })

    channel.on('broadcast', { event: 'accept_hand' }, ({ payload }) => {
      if (payload.targetUserId === myUserId) {
        setHandUp(false)
        setMessages(prev => [...prev, {
          id: String(Date.now()), userId: 'system', username: 'Instructor',
          text: '✅ You have been accepted to speak.', instructor: true,
        }])
      }
    })

    channel.on('broadcast', { event: 'join_approve' }, ({ payload }) => {
      if (payload.targetUserId === myUserId) {
        setWaitingForApproval(false)
        setAdmitted(true)
        channel.track({ username: myUsername, avatar_url: myAvatarUrl, handUp: false, status: 'joined' })
        joinAgoraRTC()
      }
    })

    channel.on('broadcast', { event: 'join_deny' }, ({ payload }) => {
      if (payload.targetUserId === myUserId) {
        setWaitingForApproval(false)
        setDenied(true)
      }
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ username: myUsername, avatar_url: myAvatarUrl, handUp: false, status: myStatus })
        if (isInstructor) {
          joinAgoraRTC()
        } else {
          setWaitingForApproval(true)
        }
      }
    })

    return () => {
      channel.unsubscribe()
      realtimeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user, channelName, isInstructor, joinAgoraRTC])

  // ── Update presence when hand raises (uses admitted, not joined) ──
  useEffect(() => {
    if (!realtimeRef.current || !user || !admitted) return
    const myUsername  = (user as any).username  ?? 'Participant'
    const myAvatarUrl = (user as any).avatar_url ?? null
    const myStatus    = isInstructor ? 'instructor' : 'joined'
    realtimeRef.current.track({ username: myUsername, avatar_url: myAvatarUrl, handUp, status: myStatus })
  }, [handUp, user, admitted, isInstructor])

  // ── Cleanup on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      localAudioRef.current?.close()
      clientRef.current?.leave().catch(() => {})
    }
  }, [])

  // ── Derived ───────────────────────────────────────────────
  // Optimistic: exclude accepted users from pending list until presence syncs
  const pendingRequests = participants.filter(p =>
    p.status === 'waiting' && !p.isSelf && !acceptedIds.has(p.userId)
  )

  // ── Instructor controls ───────────────────────────────────
  const approveRequest = (targetUserId: string) => {
    realtimeRef.current?.send({ type: 'broadcast', event: 'join_approve', payload: { targetUserId } })
    setAcceptedIds(prev => new Set([...prev, targetUserId]))
  }
  const denyRequest = (targetUserId: string) => {
    realtimeRef.current?.send({ type: 'broadcast', event: 'join_deny', payload: { targetUserId } })
    setAcceptedIds(prev => new Set([...prev, targetUserId]))
  }
  const kickParticipant = (targetUserId: string) => {
    realtimeRef.current?.send({ type: 'broadcast', event: 'kick', payload: { targetUserId } })
  }
  const muteParticipant = (targetUserId: string) => {
    realtimeRef.current?.send({ type: 'broadcast', event: 'mute', payload: { targetUserId } })
  }
  const acceptHand = (targetUserId: string) => {
    realtimeRef.current?.send({ type: 'broadcast', event: 'accept_hand', payload: { targetUserId } })
  }

  // ── Camera (instructor only) ──────────────────────────────
  const toggleCamera = async () => {
    if (!joined || !clientRef.current || !isInstructor) return
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      if (!cameraOn) {
        const video = await AgoraRTC.createCameraVideoTrack()
        localCameraRef.current = video
        await clientRef.current.publish([video])
        if (mainVideoRef.current) video.play(mainVideoRef.current)
        setCameraOn(true)
      } else {
        if (localCameraRef.current) {
          await clientRef.current.unpublish([localCameraRef.current])
          localCameraRef.current.stop()
          localCameraRef.current.close()
          localCameraRef.current = null
        }
        setCameraOn(false)
      }
    } catch { setRtcError('Camera access denied.') }
  }

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
      instructor: isInstructor,
    }
    setMessages(prev => [...prev, msg])
    realtimeRef.current?.send({ type: 'broadcast', event: 'chat', payload: msg })
    setChatInput('')
  }

  if (!isOpen) return null

  const hasRemoteVideo = remoteUsers.some(u => u.videoTrack)
  const admittedCount  = participants.filter(p => p.status !== 'waiting').length || 1

  // ── Waiting screen ────────────────────────────────────────
  if (waitingForApproval) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex flex-col items-center justify-center gap-6 px-8"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="w-16 h-16 rounded-full bg-[#1e1e1e] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#FF6B2B] animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-lg mb-1">{t('waiting_admission')}</p>
          <p className="text-[#555] text-sm">{t('waiting_admission_sub')}</p>
        </div>
        <button onClick={leaveAndClose}
          className="mt-4 bg-[#1e1e1e] text-white px-6 py-3 rounded-full font-semibold text-sm border border-[rgba(255,255,255,0.08)]">
          {t('cancel')}
        </button>
      </div>
    )
  }

  // ── Denied screen ─────────────────────────────────────────
  if (denied) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex flex-col items-center justify-center gap-6 px-8"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <X className="w-8 h-8 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-lg mb-1">{t('request_denied')}</p>
          <p className="text-[#555] text-sm">{t('request_denied_sub')}</p>
        </div>
        <button onClick={leaveAndClose}
          className="mt-4 bg-[#1e1e1e] text-white px-6 py-3 rounded-full font-semibold text-sm border border-[rgba(255,255,255,0.08)]">
          {t('leave')}
        </button>
      </div>
    )
  }

  // ── Main classroom UI ─────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button onClick={leaveAndClose} className="w-9 h-9 bg-[#1e1e1e] rounded-full flex items-center justify-center">
          <X className="w-4 h-4 text-white" />
        </button>
        <div className="text-center flex-1 px-3">
          <p className="text-[#555] text-[9px] font-bold uppercase tracking-widest">
            {connecting ? t('connecting') : joined ? `🔴 ${t('live')}` : t('virtual_classroom')}
          </p>
          <p className="text-white text-xs font-bold mt-0.5 line-clamp-1">{courseTitle}</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowDotPanel(v => !v)}
            className="w-9 h-9 bg-[#1e1e1e] rounded-full flex items-center justify-center"
          >
            <MoreVertical className="w-4 h-4 text-white" />
          </button>
          {isInstructor && pendingRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF6B2B] rounded-full flex items-center justify-center text-[10px] text-white font-bold pointer-events-none">
              {pendingRequests.length}
            </span>
          )}
        </div>
      </div>

      {/* WAITING ROOM PANEL (instructor only) */}
      {showDotPanel && isInstructor && (
        <div className="mx-4 mb-3 bg-[#1a1a1a] rounded-2xl border border-[rgba(255,255,255,0.07)] overflow-hidden flex-shrink-0">
          <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.07)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#FF6B2B]" />
              <p className="text-white font-bold text-sm">{t('waiting_room')}</p>
              {pendingRequests.length > 0 && (
                <span className="bg-[#FF6B2B] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {pendingRequests.length}
                </span>
              )}
            </div>
            <button onClick={() => setShowDotPanel(false)}>
              <X className="w-4 h-4 text-[#555]" />
            </button>
          </div>
          {pendingRequests.length === 0 ? (
            <p className="px-4 py-4 text-[#444] text-sm text-center">{t('no_one_waiting')}</p>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.05)]">
              {pendingRequests.map((p, i) => (
                <div key={p.userId} className="px-4 py-3 flex items-center gap-3">
                  <Avatar name={p.username} avatarUrl={p.avatar_url} size={36} colorIndex={i + 1} />
                  <p className="text-white text-sm font-semibold flex-1 truncate">{p.username}</p>
                  <button onClick={() => denyRequest(p.userId)}
                    className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center mr-1">
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                  <button onClick={() => approveRequest(p.userId)}
                    className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ERROR BANNER */}
      {rtcError && (
        <div className="mx-4 mb-2 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 flex-shrink-0">
          <WifiOff className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-xs flex-1">{rtcError}</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setRtcError(''); joinAgoraRTC() }}
              className="text-[#FF6B2B] text-xs font-bold flex-shrink-0"
            >
              Retry
            </button>
            <button onClick={() => setRtcError('')} className="text-red-400 text-xs font-bold flex-shrink-0">✕</button>
          </div>
        </div>
      )}

      {/* MAIN VIDEO AREA — fills as much space as possible */}
      <div className="mx-4 rounded-2xl overflow-hidden bg-[#1a1a1a] relative flex-shrink-0" style={{ height: '42vh', minHeight: 220 }}>
        {/* Remote video (instructor cam seen by students) */}
        <div ref={mainVideoRef} className="w-full h-full" />

        {connecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111] gap-3">
            <Loader2 className="w-8 h-8 text-[#444] animate-spin" />
            <p className="text-[#555] text-sm">Joining classroom…</p>
          </div>
        )}

        {!connecting && !joined && !rtcError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111] gap-3">
            <Avatar name={instructorName} size={56} colorIndex={0} />
            <p className="text-[#555] text-sm">Connecting…</p>
          </div>
        )}

        {!connecting && joined && !hasRemoteVideo && !cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] gap-2">
            <Avatar name={instructorName} size={72} colorIndex={0} />
            <p className="text-white text-sm font-semibold mt-1">{instructorName}</p>
            <p className="text-[#555] text-xs">
              {isInstructor ? t('turn_on_camera') : t('waiting_instructor')}
            </p>
          </div>
        )}

        {/* Participant count */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1">
          <Users className="w-3 h-3 text-white" />
          <span className="text-white text-xs font-bold">{admittedCount}</span>
        </div>

        {/* Live indicator */}
        {joined && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/70 rounded-full px-3 py-1.5">
            <Avatar name={instructorName} size={20} colorIndex={0} />
            <span className="text-white text-xs font-semibold">{instructorName}</span>
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          </div>
        )}

      </div>

      {/* RAISED HANDS — visible to instructor when participants raise hands */}
      {isInstructor && (() => {
        const raisedHands = participants.filter(p => p.handUp && !p.isSelf)
        if (raisedHands.length === 0) return null
        return (
          <div className="mx-4 mt-3 flex-shrink-0">
            <div className="bg-[#261a00] border border-amber-500/40 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2.5 border-b border-amber-500/20">
                <span className="text-sm">✋</span>
                <p className="text-amber-400 font-bold text-xs uppercase tracking-wide flex-1">
                  {raisedHands.length === 1 ? 'Hand Raised' : `${raisedHands.length} Hands Raised`}
                </p>
              </div>
              {raisedHands.map((p, i) => (
                <div key={p.userId} className="px-4 py-2.5 flex items-center gap-3 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                  <Avatar name={p.username} avatarUrl={p.avatar_url} size={28} colorIndex={i + 2} />
                  <p className="text-white text-sm font-semibold flex-1 truncate">{p.username}</p>
                  <button
                    onClick={() => acceptHand(p.userId)}
                    className="bg-amber-500 text-black text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1"
                  >
                    <Check className="w-2.5 h-2.5" /> Accept
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* SCROLLABLE BODY */}
      <div className="flex-1 overflow-y-auto overscroll-contain mt-3">

        {/* IN THE ROOM */}
        {participants.filter(p => p.status !== 'waiting').length > 0 && (
          <div className="px-4 mb-3">
            <p className="text-white text-xs font-bold uppercase tracking-wide mb-2">
              {t('in_room')} · {admittedCount}
            </p>
            <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {participants
                .filter(p => p.status !== 'waiting')
                .map((p, i) => (
                  <div key={p.userId} className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="relative">
                      <Avatar name={p.username} avatarUrl={p.avatar_url} size={44} colorIndex={i} />
                      {p.handUp && <span className="absolute -top-1 -right-1 text-base">✋</span>}
                    </div>
                    <p className="text-[#888] text-[10px] max-w-[48px] truncate text-center">
                      {p.isSelf ? 'You' : p.username.split(' ')[0]}
                    </p>
                    {isInstructor && !p.isSelf && (
                      <div className="flex gap-1 mt-0.5">
                        {p.handUp && (
                          <button onClick={() => acceptHand(p.userId)}
                            className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center" title="Accept to speak">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </button>
                        )}
                        <button onClick={() => muteParticipant(p.userId)}
                          className="w-5 h-5 rounded-full bg-[#333] flex items-center justify-center" title="Mute">
                          <VolumeX className="w-2.5 h-2.5 text-white" />
                        </button>
                        <button onClick={() => kickParticipant(p.userId)}
                          className="w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center" title="Remove">
                          <UserX className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    )}
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

      {/* CONTROLS */}
      <div className="px-4 py-3 bg-[#111] border-t border-[rgba(255,255,255,0.06)] flex-shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <div className="flex items-center gap-3 mb-3">

          <button onClick={toggleMic} disabled={!joined}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition disabled:opacity-40 ${muted ? 'bg-[#333] text-white' : 'bg-[#FF6B2B] text-white'}`}>
            {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Camera: instructor only */}
          {isInstructor && (
            <button onClick={toggleCamera} disabled={!joined}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition disabled:opacity-40 ${cameraOn ? 'bg-[#FF6B2B] text-white' : 'bg-[#333] text-white'}`}>
              {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          )}

          {/* Raise hand: students only */}
          {!isInstructor && (
            <button onClick={() => setHandUp(v => !v)} disabled={!admitted}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition disabled:opacity-40 ${handUp ? 'bg-[#FF6B2B] text-white' : 'bg-[#333] text-white'}`}>
              <Hand className="w-5 h-5" />
            </button>
          )}

          <div className="flex-1" />

          <button onClick={leaveAndClose}
            className="bg-red-500 text-white font-bold px-5 py-2.5 rounded-full text-sm hover:bg-red-600 transition">
            {t('leave')}
          </button>
        </div>

        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder={t('say_something')}
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
