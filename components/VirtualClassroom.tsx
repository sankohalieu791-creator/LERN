'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Mic, MicOff, Video, VideoOff,
  Hand, X, Users, MoreVertical, Send, Loader2, WifiOff, UserX, VolumeX, Check, Bell, Monitor, MonitorOff, Paperclip, FileText, Download,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { supabase, notifyFollowers, createVideo } from '@/lib/supabase'
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
  courseId?:      string
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
  fileUrl?:   string
  fileName?:  string
  fileType?:  string
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

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s > 0 ? ` ${s}s` : ''}`
  return `${s}s`
}

export default function VirtualClassroom({
  courseTitle, instructorName, channelName, isInstructor, isOpen, onClose, courseId,
}: VirtualClassroomProps) {
  const { user } = useAuth()
  const { t } = useLanguage()

  // ── Agora refs ────────────────────────────────────────────
  const clientRef        = useRef<IAgoraRTCClient | null>(null)
  const localAudioRef    = useRef<IMicrophoneAudioTrack | null>(null)
  const localCameraRef   = useRef<ICameraVideoTrack | null>(null)
  const localScreenRef   = useRef<any>(null)
  const mainVideoRef     = useRef<HTMLDivElement>(null)
  const realtimeRef      = useRef<RealtimeChannel | null>(null)
  const chatRef          = useRef<HTMLDivElement>(null)

  // ── Recording refs ────────────────────────────────────────
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const sessionStartRef   = useRef<Date | null>(null)

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // ── Agora state ───────────────────────────────────────────
  const [joined,       setJoined]       = useState(false)
  const [connecting,   setConnecting]   = useState(false)
  const [muted,        setMuted]        = useState(true)
  const [cameraOn,     setCameraOn]     = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  const [handUp,       setHandUp]       = useState(false)
  const [rtcError,     setRtcError]     = useState('')
  const [remoteUsers,  setRemoteUsers]  = useState<IAgoraRTCRemoteUser[]>([])

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
  const [chatInput,      setChatInput]      = useState('')
  const [uploadingFile,  setUploadingFile]  = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Countdown + end screen + recording ───────────────────
  const [countdown,               setCountdown]               = useState<number | null>(null)
  const [showEndScreen,           setShowEndScreen]           = useState(false)
  const [classEndedByInstructor,  setClassEndedByInstructor]  = useState(false)
  const [sessionDurationSecs, setSessionDurationSecs] = useState(0)
  const [peakViewers,        setPeakViewers]        = useState(1)
  const [recording,          setRecording]          = useState(false)
  const [recordingBlob,      setRecordingBlob]      = useState<Blob | null>(null)
  const [uploadingRecording, setUploadingRecording] = useState(false)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  // ── Track peak viewers ────────────────────────────────────
  useEffect(() => {
    const count = participants.filter(p => p.status !== 'waiting').length
    if (count > peakViewers) setPeakViewers(count)
  }, [participants]) // eslint-disable-line

  // ── Countdown tick ────────────────────────────────────────
  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      const timer = setTimeout(() => {
        setCountdown(null)
        sessionStartRef.current = new Date()
        joinAgoraRTC()
        if (user) {
          const username  = (user as any).username  ?? 'Instructor'
          const avatarUrl = (user as any).avatar_url ?? null
          notifyFollowers(
            user.id,
            'live_class',
            `${username} is going live!`,
            `"${courseTitle}" is now live — join now`,
            courseId ? `/courses/${courseId}/classroom` : '/courses',
            { id: user.id, username, avatar_url: avatarUrl },
          )
        }
      }, 600)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setCountdown(c => c !== null ? c - 1 : null), 1000)
    return () => clearTimeout(timer)
  }, [countdown]) // eslint-disable-line

  // ── Cleanup Agora without calling onClose ─────────────────
  const cleanupAgora = useCallback(async () => {
    localAudioRef.current?.close()
    localAudioRef.current = null
    if (localCameraRef.current) {
      localCameraRef.current.stop()
      localCameraRef.current.close()
      localCameraRef.current = null
    }
    if (localScreenRef.current) {
      localScreenRef.current.stop()
      localScreenRef.current.close()
      localScreenRef.current = null
    }
    try { await clientRef.current?.leave() } catch {}
    clientRef.current = null
    setJoined(false)
    setRemoteUsers([])
    setMuted(true)
    setCameraOn(false)
    setScreenSharing(false)
  }, [])

  // ── Leave and close ───────────────────────────────────────
  const leaveAndClose = useCallback(async () => {
    await cleanupAgora()
    setRtcError('')
    setWaitingForApproval(false)
    setDenied(false)
    setShowDotPanel(false)
    setAdmitted(false)
    onCloseRef.current()
  }, [cleanupAgora])

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

    const rebuildParticipants = () => {
      const state = channel.presenceState<{
        username: string
        avatar_url: string | null
        handUp: boolean
        status: 'waiting' | 'joined' | 'instructor'
      }>()
      const list: Participant[] = Object.entries(state).map(([uid, presences]) => {
        // Supabase stacks multiple presence entries per key when track() is called
        // more than once. Merge them so the latest handUp/status wins.
        const merged = presences.reduce((acc, p) => ({ ...acc, ...p }))
        return {
          userId:     uid,
          username:   merged.username,
          avatar_url: merged.avatar_url,
          handUp:     merged.handUp ?? false,
          status:     merged.status ?? 'waiting',
          isSelf:     uid === myUserId,
        }
      })
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

    channel.on('broadcast', { event: 'class_ended' }, () => {
      if (!isInstructor) {
        setClassEndedByInstructor(true)
        cleanupAgora()
      }
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
          setCountdown(3)
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

  // ── Update presence when hand raises ─────────────────────
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
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop()
      }
    }
  }, [])

  // ── Recording ─────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: cameraOn })
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : ''
      recordedChunksRef.current = []
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'video/webm' })
        setRecordingBlob(blob)
        setRecording(false)
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setRecording(true)
      setRecordingBlob(null)
    } catch (e: any) {
      setRtcError('Recording unavailable: ' + (e.message || 'Permission denied'))
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  const stopRecordingAsync = (): Promise<void> => new Promise(resolve => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      resolve(); return
    }
    mediaRecorderRef.current.addEventListener('stop', () => resolve(), { once: true })
    mediaRecorderRef.current.stop()
  })

  // ── End class (instructor) ────────────────────────────────
  const handleEndClass = async () => {
    // Tell all students the class is over before we clean up
    realtimeRef.current?.send({ type: 'broadcast', event: 'class_ended', payload: {} })
    if (recording) await stopRecordingAsync()
    const duration = sessionStartRef.current
      ? Math.floor((Date.now() - sessionStartRef.current.getTime()) / 1000)
      : 0
    setSessionDurationSecs(duration)
    setShowEndScreen(true)
    await cleanupAgora()
  }

  // ── Post recording to feed ────────────────────────────────
  const handlePostToFeed = async () => {
    if (!recordingBlob || !user) return
    setUploadingRecording(true)
    try {
      const ext  = recordingBlob.type.includes('mp4') ? 'mp4' : 'webm'
      const path = `${user.id}/${Date.now()}_class.${ext}`
      const { error: upErr } = await supabase.storage
        .from('recordings')
        .upload(path, recordingBlob, { contentType: recordingBlob.type })
      if (upErr) throw new Error(upErr.message)
      const { data: { publicUrl } } = supabase.storage.from('recordings').getPublicUrl(path)
      await createVideo(user.id, {
        video_url: publicUrl,
        caption:   `Class recording: ${courseTitle}`,
        title:     courseTitle,
      })
      onCloseRef.current()
    } catch (e: any) {
      setRtcError(e.message)
      setUploadingRecording(false)
    }
  }

  const handleDownloadRecording = () => {
    if (!recordingBlob) return
    const ext = recordingBlob.type.includes('mp4') ? 'mp4' : 'webm'
    const url = URL.createObjectURL(recordingBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${courseTitle.replace(/\s+/g, '_')}_recording.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Instructor controls ───────────────────────────────────
  const pendingRequests = participants.filter(p =>
    p.status === 'waiting' && !p.isSelf && !acceptedIds.has(p.userId)
  )

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

  // ── Camera ────────────────────────────────────────────────
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

  const toggleScreenShare = async () => {
    if (!joined || !clientRef.current) return
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      if (!screenSharing) {
        // createScreenVideoTrack returns a single track or [video, audio] tuple
        const result = await AgoraRTC.createScreenVideoTrack(
          { encoderConfig: '1080p_1', optimizationMode: 'detail' },
          'disable'
        )
        const screenTrack = Array.isArray(result) ? result[0] : result
        localScreenRef.current = screenTrack
        await clientRef.current.publish([screenTrack])
        if (mainVideoRef.current) screenTrack.play(mainVideoRef.current)
        setScreenSharing(true)
        // Stop screen share if the browser's built-in "Stop sharing" button is clicked
        screenTrack.on('track-ended', async () => {
          await clientRef.current?.unpublish([screenTrack])
          screenTrack.stop()
          screenTrack.close()
          localScreenRef.current = null
          setScreenSharing(false)
        })
      } else {
        if (localScreenRef.current) {
          await clientRef.current.unpublish([localScreenRef.current])
          localScreenRef.current.stop()
          localScreenRef.current.close()
          localScreenRef.current = null
        }
        setScreenSharing(false)
      }
    } catch (e: any) {
      if (e?.name !== 'NotAllowedError') {
        setRtcError('Screen sharing unavailable: ' + (e?.message || 'Permission denied'))
      }
    }
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

  const handleFileShare = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 25 * 1024 * 1024) {
      setRtcError('File too large — maximum 25 MB')
      return
    }
    setUploadingFile(true)
    try {
      const ext  = file.name.split('.').pop() ?? 'bin'
      const path = `classroom/${channelName}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
      const { error: upErr } = await supabase.storage
        .from('classroom-files')
        .upload(path, file, { contentType: file.type })
      if (upErr) throw new Error(upErr.message)
      const { data: { publicUrl } } = supabase.storage
        .from('classroom-files')
        .getPublicUrl(path)
      const msg: ChatMessage = {
        id:         String(Date.now()),
        userId:     user.id,
        username:   (user as any).username ?? 'You',
        text:       '',
        instructor: isInstructor,
        fileUrl:    publicUrl,
        fileName:   file.name,
        fileType:   file.type,
      }
      setMessages(prev => [...prev, msg])
      realtimeRef.current?.send({ type: 'broadcast', event: 'chat', payload: msg })
    } catch (err: any) {
      setRtcError('File upload failed: ' + (err?.message ?? 'Unknown error'))
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
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

  // ── Class ended by instructor (students only) ─────────────
  if (classEndedByInstructor) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex flex-col items-center justify-center gap-6 px-8"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center">
          <span style={{ fontSize: 36 }}>🎓</span>
        </div>
        <div className="text-center">
          <p className="text-[#FF6B2B] text-xs font-bold uppercase tracking-[0.2em] mb-2">Class Ended</p>
          <p className="text-white font-bold text-lg mb-1">{courseTitle}</p>
          <p className="text-[#555] text-sm">The instructor has ended this session.</p>
        </div>
        <button onClick={leaveAndClose}
          className="mt-2 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold px-8 py-3 rounded-full text-sm">
          Back
        </button>
      </div>
    )
  }

  // ── Main classroom UI ─────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* ── CSS for countdown animation ── */}
      <style>{`
        @keyframes countdownPop {
          0%   { transform: scale(1.6); opacity: 0; }
          55%  { transform: scale(0.92); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        .countdown-num { animation: countdownPop 0.45s cubic-bezier(.22,1,.36,1) forwards; }
        @keyframes liveFlash {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: 0.6; transform: scale(1.08); }
        }
        .live-flash { animation: liveFlash 0.4s ease-in-out 2; }
      `}</style>

      {/* ── COUNTDOWN OVERLAY ── */}
      {countdown !== null && (
        <div className="absolute inset-0 z-20 bg-black flex flex-col items-center justify-center gap-5">
          <p className="text-[#FF6B2B] text-xs font-bold uppercase tracking-[0.2em]">Going Live</p>
          <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
            <svg className="absolute inset-0" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="72" fill="none" stroke="rgba(255,107,43,0.15)" strokeWidth="4" />
              <circle cx="80" cy="80" r="72" fill="none" stroke="#FF6B2B" strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 72}`}
                strokeDashoffset={`${2 * Math.PI * 72 * (1 - (countdown > 0 ? countdown / 3 : 0))}`}
                style={{ transition: 'stroke-dashoffset 0.9s linear', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
              />
            </svg>
            {countdown === 0 ? (
              <span className="live-flash text-[#FF6B2B] font-black text-3xl tracking-widest">LIVE</span>
            ) : (
              <span key={countdown} className="countdown-num text-white font-black"
                style={{ fontSize: '5.5rem', lineHeight: 1 }}>
                {countdown}
              </span>
            )}
          </div>
          <p className="text-[#444] text-sm font-medium line-clamp-1 px-8 text-center">{courseTitle}</p>
        </div>
      )}

      {/* ── END SCREEN ── */}
      {showEndScreen && (
        <div className="absolute inset-0 z-20 bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#111] flex flex-col items-center justify-center px-6 gap-6">
          {/* Icon */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center shadow-[0_0_40px_rgba(255,107,43,0.3)]">
            <span style={{ fontSize: 36 }}>🎓</span>
          </div>

          {/* Title */}
          <div className="text-center">
            <p className="text-[#FF6B2B] text-xs font-bold uppercase tracking-[0.2em] mb-2">Class Ended</p>
            <p className="text-white text-xl font-black line-clamp-2 text-center">{courseTitle}</p>
          </div>

          {/* Stats card */}
          <div className="w-full bg-[#161616] rounded-2xl border border-[rgba(255,255,255,0.07)] overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-[rgba(255,255,255,0.07)]">
              <div className="p-5 text-center">
                <p className="text-white text-3xl font-black">{formatDuration(sessionDurationSecs)}</p>
                <p className="text-[#555] text-xs mt-1 font-medium">Duration</p>
              </div>
              <div className="p-5 text-center">
                <p className="text-white text-3xl font-black">{peakViewers}</p>
                <p className="text-[#555] text-xs mt-1 font-medium">Peak Viewers</p>
              </div>
            </div>
            {recordingBlob && (
              <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.06)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <p className="text-[#888] text-xs">
                  Recording saved · {(recordingBlob.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            )}
          </div>

          {/* Recording actions */}
          {recordingBlob ? (
            <div className="w-full space-y-3">
              <button
                onClick={handlePostToFeed}
                disabled={uploadingRecording}
                className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
              >
                {uploadingRecording
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Uploading…</>
                  : '📤  Post Recording to Feed'}
              </button>
              <button
                onClick={handleDownloadRecording}
                className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-transform"
              >
                💾  Save to Device
              </button>
            </div>
          ) : (
            <div className="w-full bg-[#161616] rounded-2xl border border-[rgba(255,255,255,0.06)] px-4 py-3 text-center">
              <p className="text-[#444] text-sm">No recording was made this session.</p>
              <p className="text-[#333] text-xs mt-0.5">Use the Record button next time to capture your class.</p>
            </div>
          )}

          <button
            onClick={() => { setShowEndScreen(false); onCloseRef.current() }}
            className="text-[#444] text-sm font-semibold py-2 px-6 active:text-white transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button onClick={leaveAndClose} className="w-9 h-9 bg-[#1e1e1e] rounded-full flex items-center justify-center">
          <X className="w-4 h-4 text-white" />
        </button>
        <div className="text-center flex-1 px-3">
          {recording && (
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 text-[9px] font-bold uppercase tracking-widest">Recording</span>
            </div>
          )}
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

      {/* MAIN VIDEO AREA */}
      <div className="mx-4 rounded-2xl overflow-hidden bg-[#1a1a1a] relative flex-shrink-0" style={{ height: '42vh', minHeight: 220 }}>
        <div ref={mainVideoRef} className="w-full h-full" />

        {connecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111] gap-3">
            <Loader2 className="w-8 h-8 text-[#444] animate-spin" />
            <p className="text-[#555] text-sm">Joining classroom…</p>
          </div>
        )}

        {!connecting && !joined && !rtcError && countdown === null && (
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

      {/* RAISED HANDS */}
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
              {m.fileUrl ? (
                m.fileType?.startsWith('image/') ? (
                  <a href={m.fileUrl} target="_blank" rel="noopener noreferrer">
                    <img src={m.fileUrl} alt={m.fileName} className="max-w-[200px] rounded-xl mt-1 border border-[rgba(255,255,255,0.1)]" />
                  </a>
                ) : (
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={m.fileName}
                    className="flex items-center gap-2.5 mt-1 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 max-w-[220px] active:opacity-80"
                  >
                    <FileText className="w-5 h-5 text-[#FF6B2B] flex-shrink-0" />
                    <span className="text-white text-xs font-semibold truncate flex-1">{m.fileName}</span>
                    <Download className="w-4 h-4 text-[#555] flex-shrink-0" />
                  </a>
                )
              ) : (
                <p className="text-white text-sm">{m.text}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="px-4 py-3 bg-[#111] border-t border-[rgba(255,255,255,0.06)] flex-shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <div className="flex items-center gap-3 mb-3">

          {/* Mic */}
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

          {/* Screen share: everyone admitted */}
          <button
            onClick={toggleScreenShare}
            disabled={!joined}
            title={screenSharing ? 'Stop sharing screen' : 'Share your screen'}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition disabled:opacity-40 ${screenSharing ? 'bg-[#1d9bf0] text-white' : 'bg-[#333] text-white'}`}
          >
            {screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          {/* Record: instructor only */}
          {isInstructor && (
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={!joined}
              title={recording ? 'Stop recording' : 'Start recording'}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition disabled:opacity-40 ${
                recording ? 'bg-red-500 text-white' : 'bg-[#333] text-white'
              }`}
            >
              {recording ? (
                <span className="w-3.5 h-3.5 bg-white rounded-sm" />
              ) : (
                <span className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                </span>
              )}
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

          {/* End Class (instructor) / Leave (student) */}
          {isInstructor ? (
            <button
              onClick={handleEndClass}
              disabled={!joined}
              className="bg-red-500 text-white font-bold px-5 py-2.5 rounded-full text-sm hover:bg-red-600 transition disabled:opacity-40"
            >
              End Class
            </button>
          ) : (
            <button onClick={leaveAndClose}
              className="bg-red-500 text-white font-bold px-5 py-2.5 rounded-full text-sm hover:bg-red-600 transition">
              {t('leave')}
            </button>
          )}
        </div>

        <form onSubmit={sendMessage} className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
            className="hidden"
            onChange={handleFileShare}
          />
          {/* Paperclip button */}
          <button
            type="button"
            disabled={uploadingFile || !admitted}
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-full flex items-center justify-center disabled:opacity-30 flex-shrink-0"
          >
            {uploadingFile
              ? <Loader2 className="w-4 h-4 text-[#888] animate-spin" />
              : <Paperclip className="w-4 h-4 text-[#888]" />
            }
          </button>
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
