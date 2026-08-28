'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { IAgoraRTCClient, IAgoraRTCRemoteUser, ICameraVideoTrack, IMicrophoneAudioTrack, ILocalVideoTrack } from 'agora-rtc-sdk-ng'
import { X, Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, Users, Square } from 'lucide-react'
import { endWorkshop } from '@/lib/supabase'

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!

// A live online workshop room — real Agora RTC (camera, mic, screen share,
// everyone's video tiles), same SDK/token pattern as the old platform's
// classroom. Deliberately leaner than that one: no waiting room / hand-
// raise / force-mute moderation layer, just "everyone in the room can see
// and hear each other and share their screen" — the actual ask here.
export default function WorkshopSession({
  workItemId, title, canEnd, onClose, onEnded,
}: { workItemId: string; title: string; canEnd?: boolean; onClose: () => void; onEnded?: () => void }) {
  const channelName = `workshop-${workItemId}`
  const clientRef = useRef<IAgoraRTCClient | null>(null)
  const cameraRef = useRef<ICameraVideoTrack | null>(null)
  const micRef = useRef<IMicrophoneAudioTrack | null>(null)
  const screenRef = useRef<ILocalVideoTrack | null>(null)
  const selfTileRef = useRef<HTMLDivElement>(null)

  const [connecting, setConnecting] = useState(true)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([])
  const [cameraOn, setCameraOn] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)

  const join = useCallback(async () => {
    if (clientRef.current) return
    setConnecting(true)
    setError('')
    try {
      let token: string | null = null
      try {
        const res = await fetch(`/api/agora-token?channel=${encodeURIComponent(channelName)}&uid=0`)
        if (res.ok) token = (await res.json()).token ?? null
      } catch {}

      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      AgoraRTC.setLogLevel(1)
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })

      client.on('user-published', async (remoteUser, mediaType) => {
        await client.subscribe(remoteUser, mediaType)
        if (mediaType === 'audio') remoteUser.audioTrack?.play()
        setRemoteUsers(prev => prev.find(u => u.uid === remoteUser.uid) ? [...prev] : [...prev, remoteUser])
      })
      client.on('user-unpublished', (remoteUser, mediaType) => {
        if (mediaType === 'video') remoteUser.videoTrack?.stop()
        setRemoteUsers(prev => [...prev])
      })
      client.on('user-left', remoteUser => {
        setRemoteUsers(prev => prev.filter(u => u.uid !== remoteUser.uid))
      })

      clientRef.current = client
      await client.join(APP_ID, channelName, token, null)
      setJoined(true)
    } catch (err: any) {
      setError(err?.message || 'Could not connect to the session.')
      clientRef.current = null
    } finally {
      setConnecting(false)
    }
  }, [channelName])

  useEffect(() => {
    join()
    return () => {
      cameraRef.current?.close()
      micRef.current?.close()
      screenRef.current?.close()
      clientRef.current?.leave().catch(() => {})
      clientRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render remote video into their tile whenever the DOM node for that
  // uid exists (tiles mount after remoteUsers updates).
  useEffect(() => {
    for (const u of remoteUsers) {
      const el = document.getElementById(`remote-${u.uid}`)
      if (el && u.videoTrack) u.videoTrack.play(el)
    }
  }, [remoteUsers])

  const toggleCamera = async () => {
    if (!clientRef.current) return
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      if (!cameraOn) {
        const video = await AgoraRTC.createCameraVideoTrack()
        cameraRef.current = video
        await clientRef.current.publish([video])
        if (selfTileRef.current) video.play(selfTileRef.current)
        setCameraOn(true)
      } else {
        if (cameraRef.current) {
          await clientRef.current.unpublish([cameraRef.current])
          cameraRef.current.close()
          cameraRef.current = null
        }
        setCameraOn(false)
      }
    } catch { setError('Camera access denied.') }
  }

  const toggleMic = async () => {
    if (!clientRef.current) return
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      if (!micOn) {
        const audio = await AgoraRTC.createMicrophoneAudioTrack()
        micRef.current = audio
        await clientRef.current.publish([audio])
        setMicOn(true)
      } else {
        if (micRef.current) {
          await clientRef.current.unpublish([micRef.current])
          micRef.current.close()
          micRef.current = null
        }
        setMicOn(false)
      }
    } catch { setError('Microphone access denied.') }
  }

  const toggleScreenShare = async () => {
    if (!clientRef.current) return
    if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
      setError('Screen sharing needs a desktop browser.')
      return
    }
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      if (!screenSharing) {
        const result = await AgoraRTC.createScreenVideoTrack({ encoderConfig: '1080p_1', optimizationMode: 'detail' }, 'disable')
        const track = Array.isArray(result) ? result[0] : result
        screenRef.current = track
        await clientRef.current.publish([track])
        if (selfTileRef.current) track.play(selfTileRef.current)
        setScreenSharing(true)
        track.on('track-ended', async () => {
          await clientRef.current?.unpublish([track])
          track.close()
          screenRef.current = null
          setScreenSharing(false)
        })
      } else {
        if (screenRef.current) {
          await clientRef.current.unpublish([screenRef.current])
          screenRef.current.close()
          screenRef.current = null
        }
        setScreenSharing(false)
      }
    } catch (e: any) {
      if (e?.name !== 'NotAllowedError') setError('Screen sharing failed: ' + (e?.message || 'Unknown error'))
    }
  }

  const leave = async () => {
    cameraRef.current?.close(); micRef.current?.close(); screenRef.current?.close()
    await clientRef.current?.leave().catch(() => {})
    clientRef.current = null
    onClose()
  }

  const endForEveryone = async () => {
    await endWorkshop(workItemId)
    await leave()
    onEnded?.()
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#141110] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0">
        <div>
          <p className="text-white font-bold text-[15px]">{title}</p>
          <p className="text-[#8A8373] text-[12px] flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> {remoteUsers.length + (joined ? 1 : 0)} in the room
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEnd && (
            <button onClick={endForEveryone} className="flex items-center gap-1.5 bg-[#B3401E] hover:bg-[#9c3419] text-white text-[12px] font-semibold px-3 py-2 rounded-full transition">
              <Square className="w-3 h-3 fill-current" /> End for everyone
            </button>
          )}
          <button onClick={leave} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {connecting ? (
          <div className="h-full flex items-center justify-center text-[#8A8373]">Connecting…</div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-white font-semibold">{error}</p>
            <button onClick={join} className="text-brand font-semibold text-[13px]">Try again</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div ref={selfTileRef} className="aspect-video bg-[#221D19] rounded-xl relative overflow-hidden flex items-center justify-center">
              {!cameraOn && !screenSharing && <VideoOff className="w-6 h-6 text-[#5A544A]" />}
              <span className="absolute bottom-2 left-2.5 text-white text-[11px] font-semibold bg-black/40 px-2 py-0.5 rounded-full">You</span>
            </div>
            {remoteUsers.map(u => (
              <div key={u.uid} id={`remote-${u.uid}`} className="aspect-video bg-[#221D19] rounded-xl relative overflow-hidden flex items-center justify-center">
                <VideoOff className="w-6 h-6 text-[#5A544A]" />
                <span className="absolute bottom-2 left-2.5 text-white text-[11px] font-semibold bg-black/40 px-2 py-0.5 rounded-full">Participant</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 px-5 py-4 flex-shrink-0 border-t border-white/10">
        <RoomButton active={micOn} onClick={toggleMic} onIcon={Mic} offIcon={MicOff} disabled={!joined} />
        <RoomButton active={cameraOn} onClick={toggleCamera} onIcon={Video} offIcon={VideoOff} disabled={!joined} />
        <button
          onClick={toggleScreenShare} disabled={!joined}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition ${screenSharing ? 'bg-brand text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          <ScreenShare className="w-[18px] h-[18px]" />
        </button>
        <button onClick={leave} className="w-11 h-11 rounded-full bg-[#B3401E] text-white flex items-center justify-center hover:bg-[#9c3419] transition">
          <PhoneOff className="w-[18px] h-[18px]" />
        </button>
      </div>
    </div>
  )
}

function RoomButton({ active, onClick, onIcon: OnIcon, offIcon: OffIcon, disabled }: { active: boolean; onClick: () => void; onIcon: any; offIcon: any; disabled?: boolean }) {
  const Icon = active ? OnIcon : OffIcon
  return (
    <button
      onClick={onClick} disabled={disabled}
      className={`w-11 h-11 rounded-full flex items-center justify-center transition ${active ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white/10 text-[#8A8373] hover:bg-white/20'}`}
    >
      <Icon className="w-[18px] h-[18px]" />
    </button>
  )
}
