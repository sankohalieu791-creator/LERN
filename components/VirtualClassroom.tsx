'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Mic, MicOff, Video as VideoIcon, VideoOff,
  Hand, X, Users, MoreVertical, Send, Loader2, WifiOff,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng'

interface VirtualClassroomProps {
  courseTitle:     string
  instructorName:  string
  channelName:     string   // courseId used as the Agora channel
  isOpen:          boolean
  onClose:         () => void
}

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!

const AVATAR_COLORS = [
  'from-red-500 to-orange-500',
  'from-blue-500 to-purple-500',
  'from-green-500 to-teal-500',
  'from-yellow-500 to-orange-500',
  'from-pink-500 to-rose-500',
]

export default function VirtualClassroom({
  courseTitle, instructorName, channelName, isOpen, onClose,
}: VirtualClassroomProps) {
  const { user } = useAuth()

  // ── Agora refs ────────────────────────────────────────────
  const clientRef        = useRef<IAgoraRTCClient | null>(null)
  const localAudioRef    = useRef<IMicrophoneAudioTrack | null>(null)
  const localVideoRef    = useRef<ICameraVideoTrack | null>(null)
  const remoteVideoElRef = useRef<HTMLDivElement>(null)
  const localVideoElRef  = useRef<HTMLDivElement>(null)

  // ── State ─────────────────────────────────────────────────
  const [joined,      setJoined]      = useState(false)
  const [connecting,  setConnecting]  = useState(false)
  const [muted,       setMuted]       = useState(true)
  const [camOff,      setCamOff]      = useState(true)
  const [handUp,      setHandUp]      = useState(false)
  const [rtcError,    setRtcError]    = useState('')
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([])
  const [userCount,   setUserCount]   = useState(1)

  // ── Chat (local — extend with Supabase Realtime for persistence) ──
  const [chatInput, setChatInput] = useState('')
  const [messages,  setMessages]  = useState([
    { id: '1', user: instructorName, text: "Welcome — we'll start in a moment.", instructor: true },
  ])
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  // ── Join Agora channel ────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    const join = async () => {
      setConnecting(true)
      setRtcError('')
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
        AgoraRTC.setLogLevel(3) // errors only

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
        if (cancelled) return
        clientRef.current = client

        client.on('user-published', async (remoteUser, mediaType) => {
          await client.subscribe(remoteUser, mediaType)
          if (mediaType === 'video' && remoteVideoElRef.current) {
            remoteUser.videoTrack?.play(remoteVideoElRef.current)
          }
          if (mediaType === 'audio') {
            remoteUser.audioTrack?.play()
          }
          setRemoteUsers(prev =>
            prev.find(u => u.uid === remoteUser.uid) ? prev : [...prev, remoteUser]
          )
          setUserCount(c => c + 1)
        })

        client.on('user-unpublished', (remoteUser, mediaType) => {
          if (mediaType === 'video') remoteUser.videoTrack?.stop()
        })

        client.on('user-left', (remoteUser) => {
          setRemoteUsers(prev => prev.filter(u => u.uid !== remoteUser.uid))
          setUserCount(c => Math.max(1, c - 1))
        })

        // null token = Agora test mode
        // For production: generate a token from your token server and pass it here
        await client.join(APP_ID, channelName, null, null)

        if (!cancelled) {
          setJoined(true)
          setConnecting(false)
        }
      } catch (err: any) {
        if (!cancelled) {
          setRtcError(err.message || 'Could not connect to classroom')
          setConnecting(false)
        }
      }
    }

    join()
    return () => { cancelled = true }
  }, [isOpen, channelName])

  // ── Cleanup on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      localAudioRef.current?.close()
      localVideoRef.current?.stop()
      localVideoRef.current?.close()
      clientRef.current?.leave().catch(() => {})
    }
  }, [])

  // ── Leave + close ─────────────────────────────────────────
  const leaveAndClose = useCallback(async () => {
    localAudioRef.current?.close()
    localVideoRef.current?.stop()
    localVideoRef.current?.close()
    localAudioRef.current = null
    localVideoRef.current = null
    try { await clientRef.current?.leave() } catch {}
    clientRef.current = null
    setJoined(false)
    setRemoteUsers([])
    setMuted(true)
    setCamOff(true)
    setRtcError('')
    onClose()
  }, [onClose])

  // ── Toggle microphone ─────────────────────────────────────
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
    } catch {
      setRtcError('Microphone access denied — check browser permissions.')
    }
  }

  // ── Toggle camera ─────────────────────────────────────────
  const toggleCam = async () => {
    if (!joined || !clientRef.current) return
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      if (camOff) {
        const video = await AgoraRTC.createCameraVideoTrack()
        localVideoRef.current = video
        await clientRef.current.publish([video])
        if (localVideoElRef.current) video.play(localVideoElRef.current)
        setCamOff(false)
      } else {
        if (localVideoRef.current) {
          await clientRef.current.unpublish([localVideoRef.current])
          localVideoRef.current.stop()
          localVideoRef.current.close()
          localVideoRef.current = null
        }
        setCamOff(true)
      }
    } catch {
      setRtcError('Camera access denied — check browser permissions.')
    }
  }

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    setMessages(m => [...m, {
      id:         String(Date.now()),
      user:       user?.username || 'You',
      text:       chatInput.trim(),
      instructor: false,
    }])
    setChatInput('')
  }

  if (!isOpen) return null

  const hasRemoteVideo = remoteUsers.some(u => u.videoTrack)

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex flex-col">

      {/* ── HEADER ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button
          onClick={leaveAndClose}
          className="w-9 h-9 bg-[#1e1e1e] rounded-full flex items-center justify-center"
        >
          <X className="w-4 h-4 text-white" />
        </button>
        <div className="text-center">
          <p className="text-[#555] text-[9px] font-bold uppercase tracking-widest">
            {connecting ? 'Connecting…' : joined ? '🔴 Live · Virtual Classroom' : 'Virtual Classroom'}
          </p>
          <p className="text-white text-xs font-bold mt-0.5 line-clamp-1">{courseTitle}</p>
        </div>
        <button className="w-9 h-9 bg-[#1e1e1e] rounded-full flex items-center justify-center">
          <MoreVertical className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* ── ERROR BANNER ──────────────────────────────────── */}
      {rtcError && (
        <div className="mx-4 mb-2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          <WifiOff className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-xs flex-1">{rtcError}</p>
          <button onClick={() => setRtcError('')} className="text-red-400 text-xs font-bold">✕</button>
        </div>
      )}

      {/* ── SCROLLABLE BODY ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* MAIN VIDEO AREA */}
        <div className="mx-4 rounded-2xl overflow-hidden aspect-video bg-[#1a1a1a] relative mb-4">

          {/* Remote video renders here */}
          <div ref={remoteVideoElRef} className="w-full h-full" />

          {/* Connecting overlay */}
          {connecting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111] gap-3">
              <Loader2 className="w-8 h-8 text-[#444] animate-spin" />
              <p className="text-[#555] text-sm">Joining classroom…</p>
            </div>
          )}

          {/* Waiting for instructor video */}
          {!connecting && joined && !hasRemoteVideo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] gap-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-2xl font-bold mb-1">
                {instructorName[0]}
              </div>
              <p className="text-white text-sm font-semibold">{instructorName}</p>
              <p className="text-[#555] text-xs">Waiting for instructor to go live…</p>
            </div>
          )}

          {/* Local cam — picture-in-picture */}
          {!camOff && (
            <div
              ref={localVideoElRef}
              className="absolute bottom-3 right-3 w-20 h-28 rounded-xl overflow-hidden border-2 border-white/20 bg-[#111]"
            />
          )}

          {/* Viewer count */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1">
            <Users className="w-3 h-3 text-white" />
            <span className="text-white text-xs font-bold">{userCount}</span>
          </div>

          {/* Instructor label */}
          {!connecting && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/70 rounded-full px-3 py-1.5">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-[9px] font-bold">
                {instructorName[0]}
              </div>
              <span className="text-white text-xs font-semibold">{instructorName}</span>
              {joined && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
            </div>
          )}
        </div>

        {/* IN THE ROOM */}
        {remoteUsers.length > 0 && (
          <div className="px-4 mb-4">
            <p className="text-white text-xs font-bold uppercase tracking-wide mb-3">
              In the room · {userCount}
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {remoteUsers.map((u, i) => (
                <div key={String(u.uid)} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold text-base`}>
                    {String(u.uid).slice(-1).toUpperCase()}
                  </div>
                  <p className="text-[#888] text-[10px]">#{String(u.uid).slice(-4)}</p>
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
                {m.user}
              </p>
              <p className="text-white text-sm">{m.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTROLS ──────────────────────────────────────── */}
      <div className="px-4 py-3 bg-[#111] border-t border-[rgba(255,255,255,0.06)] flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">

          <button
            onClick={toggleMic}
            disabled={!joined}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition disabled:opacity-40 ${
              muted ? 'bg-[#333] text-white' : 'bg-[#FF6B2B] text-white'
            }`}
          >
            {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleCam}
            disabled={!joined}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition disabled:opacity-40 ${
              camOff ? 'bg-[#333] text-white' : 'bg-[#FF6B2B] text-white'
            }`}
          >
            {camOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setHandUp(v => !v)}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
              handUp ? 'bg-[#FF6B2B] text-white' : 'bg-[#333] text-white'
            }`}
          >
            <Hand className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <button
            onClick={leaveAndClose}
            className="bg-red-500 text-white font-bold px-5 py-2.5 rounded-full text-sm hover:bg-red-600 transition"
          >
            Leave
          </button>
        </div>

        {/* CHAT INPUT */}
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Say something to the class…"
            className="flex-1 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-full px-4 py-2.5 text-white text-sm placeholder-[#444] outline-none"
          />
          <button
            type="submit"
            disabled={!chatInput.trim()}
            className="w-9 h-9 bg-white rounded-full flex items-center justify-center disabled:opacity-30 flex-shrink-0"
          >
            <Send className="w-4 h-4 text-black" />
          </button>
        </form>
      </div>
    </div>
  )
}
