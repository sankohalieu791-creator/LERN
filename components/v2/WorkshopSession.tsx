'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { IAgoraRTCClient, IAgoraRTCRemoteUser, ICameraVideoTrack, IMicrophoneAudioTrack, ILocalVideoTrack } from 'agora-rtc-sdk-ng'
import { useAuth } from '@/context/AuthContext'
import { supabase, endWorkshop, getWorkshopMessages, sendWorkshopMessage, startRecording, stopRecording } from '@/lib/supabase'
import {
  Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, Users, Square,
  HelpCircle, Send, Hand, Circle, StopCircle, X,
} from 'lucide-react'

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!

// A LERN user id doesn't fit Agora's numeric uid requirement, so the
// channel uid is derived deterministically from it — stable across
// rejoins, and the Presence channel below maps it back to a real name.
function uidFromUserId(userId: string): number {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0
  return (Math.abs(hash) % 2147483646) + 1
}

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

// A dropped screen-share picker (user hits Cancel) surfaces under a few
// different names/messages depending on browser — none of these are a
// real failure worth showing an "Agora permission" error over.
function isBenignCancel(e: any): boolean {
  const name = (e?.name || '').toLowerCase()
  const msg = (e?.message || e?.msg || '').toLowerCase()
  return name.includes('notallowed') || name.includes('permission') || msg.includes('permission') || msg.includes('cancel') || msg.includes('denied')
}

type Participant = { uid: number; name: string; isHost: boolean; handRaised?: boolean }

// A live online session room. Main-stage layout: one big feed up top,
// everyone else as a name+avatar strip underneath — click a strip tile
// to bring that person's video to the main stage. Real Agora RTC for
// media; a Supabase Realtime Presence channel alongside it maps Agora's
// opaque numeric uids back to real names (and carries raised-hand
// state), since Agora has no concept of a LERN identity on its own. Q&A
// is a persisted table + Realtime subscription, not a broadcast, so
// someone joining late still sees what was asked.
//
// Deliberately not in this pass, flagged rather than rushed: a waiting
// room / admit-to-join gate and host mute/kick of a participant.
export default function WorkshopSession({
  workItemId, title, canEnd, onClose, onEnded,
}: { workItemId: string; title: string; canEnd?: boolean; onClose: () => void; onEnded?: () => void }) {
  const { user } = useAuth()
  const channelName = `workshop-${workItemId}`
  const myUid = user ? uidFromUserId(user.id) : 0

  const clientRef = useRef<IAgoraRTCClient | null>(null)
  const cameraRef = useRef<ICameraVideoTrack | null>(null)
  const micRef = useRef<IMicrophoneAudioTrack | null>(null)
  const screenRef = useRef<ILocalVideoTrack | null>(null)
  const mainStageRef = useRef<HTMLDivElement>(null)
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const [connecting, setConnecting] = useState(true)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('') // fatal — no session to show, replaces the whole stage
  const [actionError, setActionError] = useState('') // transient — camera/mic/share/recording hiccups; never hides the call
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([])
  const [cameraOn, setCameraOn] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [mainUid, setMainUid] = useState<number>(myUid) // whose feed is on the main stage — starts on self
  const [participants, setParticipants] = useState<Record<number, Participant>>({})
  const [qaOpen, setQaOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [draft, setDraft] = useState('')
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [recordingBusy, setRecordingBusy] = useState(false)

  const trackPresence = useCallback((extra?: Partial<Participant>) => {
    presenceRef.current?.track({ name: user?.full_name, isHost: !!canEnd, handRaised, ...extra })
  }, [user?.full_name, canEnd, handRaised])

  const join = useCallback(async () => {
    if (clientRef.current || !user) return
    setConnecting(true)
    setError('')
    try {
      let token: string | null = null
      try {
        const res = await fetch(`/api/agora-token?channel=${encodeURIComponent(channelName)}&uid=${myUid}`)
        if (res.ok) token = (await res.json()).token ?? null
      } catch {}

      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      AgoraRTC.setLogLevel(1)
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })

      client.on('user-published', async (remoteUser, mediaType) => {
        await client.subscribe(remoteUser, mediaType)
        if (mediaType === 'audio') remoteUser.audioTrack?.play()
        setRemoteUsers(prev => prev.find(u => u.uid === remoteUser.uid) ? prev.map(u => u.uid === remoteUser.uid ? remoteUser : u) : [...prev, remoteUser])
      })
      client.on('user-unpublished', (remoteUser, mediaType) => {
        if (mediaType === 'video') remoteUser.videoTrack?.stop()
        setRemoteUsers(prev => [...prev])
      })
      client.on('user-left', remoteUser => {
        setRemoteUsers(prev => prev.filter(u => u.uid !== remoteUser.uid))
      })

      clientRef.current = client
      await client.join(APP_ID, channelName, token, myUid)
      setJoined(true)

      // Presence: tell everyone else who's actually behind this uid.
      const presence = supabase.channel(`presence-${channelName}`, { config: { presence: { key: String(myUid) } } })
      presence.on('presence', { event: 'sync' }, () => {
        const state = presence.presenceState()
        const next: Record<number, Participant> = {}
        for (const key of Object.keys(state)) {
          const entry: any = (state[key] as any[])[0]
          if (entry) next[Number(key)] = { uid: Number(key), name: entry.name, isHost: entry.isHost, handRaised: entry.handRaised }
        }
        setParticipants(next)
      })
      presence.subscribe(async status => {
        if (status === 'SUBSCRIBED') await presence.track({ name: user.full_name, isHost: !!canEnd, handRaised: false })
      })
      presenceRef.current = presence
    } catch (err: any) {
      setError(err?.message || 'Could not connect to the session.')
      clientRef.current = null
    } finally {
      setConnecting(false)
    }
  }, [channelName, myUid, user, canEnd])

  useEffect(() => {
    join()
    return () => {
      cameraRef.current?.close()
      micRef.current?.close()
      screenRef.current?.close()
      clientRef.current?.leave().catch(() => {})
      clientRef.current = null
      presenceRef.current?.unsubscribe()
      presenceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!actionError) return
    const t = setTimeout(() => setActionError(''), 6000)
    return () => clearTimeout(t)
  }, [actionError])

  // Q&A: load history once, then live-append via Realtime.
  useEffect(() => {
    getWorkshopMessages(workItemId).then(({ data }) => setMessages(data || []))
    const channel = supabase
      .channel(`workshop-messages-${workItemId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workshop_messages', filter: `work_item_id=eq.${workItemId}` },
        payload => setMessages(prev => [...prev, payload.new]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [workItemId])

  // Whichever uid is "on stage" gets its video played into the main
  // element — self and remote share the same mechanism, just a
  // different track source.
  useEffect(() => {
    if (!mainStageRef.current) return
    if (mainUid === myUid) {
      if (cameraOn && cameraRef.current) cameraRef.current.play(mainStageRef.current)
      else if (screenSharing && screenRef.current) screenRef.current.play(mainStageRef.current)
    } else {
      const remote = remoteUsers.find(u => u.uid === mainUid)
      if (remote?.videoTrack) remote.videoTrack.play(mainStageRef.current)
    }
  }, [mainUid, cameraOn, screenSharing, remoteUsers, myUid])

  const toggleCamera = async () => {
    if (!clientRef.current) return
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      if (!cameraOn) {
        // Square capture (not the default 16:9) so a chest-up framing
        // actually fits the tile instead of a wide horizontal sliver.
        // Higher resolution than before since the main stage now renders
        // this much larger — 480p looked soft blown up to fill the box.
        const video = await AgoraRTC.createCameraVideoTrack({ encoderConfig: { width: 720, height: 720, frameRate: 24, bitrateMax: 1200 } })
        cameraRef.current = video
        await clientRef.current.publish([video])
        if (mainUid === myUid && mainStageRef.current) video.play(mainStageRef.current)
        setCameraOn(true)
      } else {
        if (cameraRef.current) {
          await clientRef.current.unpublish([cameraRef.current])
          cameraRef.current.close()
          cameraRef.current = null
        }
        setCameraOn(false)
      }
    } catch { setActionError('Camera access denied.') }
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
    } catch { setActionError('Microphone access denied.') }
  }

  const toggleScreenShare = async () => {
    if (!clientRef.current) return
    if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
      setActionError('Screen sharing needs a desktop browser.')
      return
    }
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      if (!screenSharing) {
        const result = await AgoraRTC.createScreenVideoTrack({ encoderConfig: '1080p_1', optimizationMode: 'detail' }, 'disable')
        const track = Array.isArray(result) ? result[0] : result
        screenRef.current = track
        await clientRef.current.publish([track])
        setMainUid(myUid) // sharing your screen brings you to the main stage
        if (mainStageRef.current) track.play(mainStageRef.current)
        setScreenSharing(true)
        track.on('track-ended', async () => {
          // Fires when the browser's own "Stop sharing" bar is used —
          // same cleanup as clicking our own toggle off.
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
      // Cancelling the browser's share picker throws too — that's not a
      // failure worth surfacing as an "Agora permission" error.
      if (!isBenignCancel(e)) setActionError('Screen sharing failed: ' + (e?.message || 'Unknown error'))
    }
  }

  const toggleHand = () => {
    const next = !handRaised
    setHandRaised(next)
    trackPresence({ handRaised: next })
  }

  const leave = async () => {
    cameraRef.current?.close(); micRef.current?.close(); screenRef.current?.close()
    await clientRef.current?.leave().catch(() => {})
    clientRef.current = null
    onClose()
  }

  const endForEveryone = async () => {
    if (recordingId) await stopRecording(recordingId)
    await endWorkshop(workItemId)
    await leave()
    onEnded?.()
  }

  const toggleRecording = async () => {
    if (!user) return
    setRecordingBusy(true)
    if (!recordingId) {
      const { recordingId: id, error: err } = await startRecording(workItemId, user.id)
      if (err) setActionError(err.message || "Recording isn't set up yet — see the migration file for what's needed.")
      else setRecordingId(id || null)
    } else {
      await stopRecording(recordingId)
      setRecordingId(null)
    }
    setRecordingBusy(false)
  }

  const send = async () => {
    if (!draft.trim() || !user) return
    await sendWorkshopMessage(workItemId, user.id, 'question', draft.trim())
    setDraft('')
  }

  const allTiles: Participant[] = [
    { uid: myUid, name: user?.full_name ? `${user.full_name} (you)` : 'You', isHost: !!canEnd, handRaised },
    ...remoteUsers.map(u => participants[u.uid as number] || { uid: u.uid as number, name: 'Participant', isHost: false }),
  ]
  const raisedHands = allTiles.filter(p => p.handRaised && p.uid !== myUid)

  return (
    <div className="fixed inset-0 z-50 bg-[#141110] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0">
        <div>
          <p className="text-white font-bold text-[15px]">{title}</p>
          <p className="text-[#8A8373] text-[12px] flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> {allTiles.length} in the room
            {recordingId && <span className="flex items-center gap-1 text-[#FF6B4E] font-semibold ml-1"><Circle className="w-2 h-2 fill-current" /> Recording</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEnd && (
            <button
              onClick={toggleRecording} disabled={recordingBusy}
              className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-full transition ${recordingId ? 'bg-[#B3401E] hover:bg-[#9c3419] text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
            >
              {recordingId ? <StopCircle className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3 fill-current text-[#FF6B4E]" />}
              {recordingId ? 'Stop recording' : 'Record'}
            </button>
          )}
          <button
            onClick={() => setQaOpen(v => !v)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition relative ${qaOpen ? 'bg-brand text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            <HelpCircle className="w-4 h-4" />
            {raisedHands.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand text-white text-[9px] font-bold flex items-center justify-center">{raisedHands.length}</span>}
          </button>
          {canEnd && (
            <button onClick={endForEveryone} className="flex items-center gap-1.5 bg-[#B3401E] hover:bg-[#9c3419] text-white text-[12px] font-semibold px-3 py-2 rounded-full transition">
              <Square className="w-3 h-3 fill-current" /> End for everyone
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mx-5 mb-2 flex-shrink-0 flex items-center justify-between gap-3 bg-[#3A241C] border border-[#5A3226] rounded-lg px-4 py-2.5">
          <p className="text-[13px] text-[#FFB89E]">{actionError}</p>
          <button onClick={() => setActionError('')} className="text-[#FFB89E] hover:text-white flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col px-5 pb-4 min-w-0">
          {connecting ? (
            <div className="flex-1 flex items-center justify-center text-[#8A8373]">Connecting…</div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-white font-semibold">{error}</p>
              <button onClick={join} className="text-brand font-semibold text-[13px]">Try again</button>
            </div>
          ) : (
            <>
              {/* Main stage — a square box, as big as the available height
                  allows (not stretched into a rectangle) so a chest-up
                  framing actually reads as a proper close-up rather than a
                  small tile lost in a wide dark bar. */}
              <div className="flex-1 min-h-0 flex items-center justify-center mb-3">
                <div ref={mainStageRef} className="h-full max-w-full aspect-square bg-[#221D19] rounded-xl relative overflow-hidden flex items-center justify-center">
                  {!((mainUid === myUid && (cameraOn || screenSharing)) || remoteUsers.find(u => u.uid === mainUid)?.videoTrack) && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-xl">
                        {initials(participants[mainUid]?.name || (mainUid === myUid ? user?.full_name : undefined))}
                      </div>
                      <VideoOff className="w-4 h-4 text-[#5A544A]" />
                    </div>
                  )}
                  <span className="absolute bottom-3 left-3.5 text-white text-[12px] font-semibold bg-black/40 px-2.5 py-1 rounded-full">
                    {mainUid === myUid ? 'You' : participants[mainUid]?.name || 'Participant'}
                  </span>
                </div>
              </div>

              {/* Everyone else — name + avatar strip, click to bring to the main stage */}
              <div className="flex gap-2.5 overflow-x-auto flex-shrink-0 pb-1">
                {allTiles.map(p => (
                  <button
                    key={p.uid} onClick={() => setMainUid(p.uid)}
                    className={`flex flex-col items-center gap-1.5 flex-shrink-0 w-16 rounded-lg py-2 transition ${p.uid === mainUid ? 'bg-white/10' : 'hover:bg-white/5'}`}
                  >
                    <div className="relative">
                      <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-[13px]">
                        {initials(p.name)}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#1E7A34] border-2 border-[#141110]" />
                      {p.handRaised && (
                        <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-brand border-2 border-[#141110] flex items-center justify-center">
                          <Hand className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#B8AE9C] truncate w-full text-center">{p.isHost ? 'Host' : p.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {qaOpen && (
          <div className="w-72 flex-shrink-0 border-l border-white/10 flex flex-col">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-white font-semibold text-[13px]">Q&A</p>
            </div>
            {raisedHands.length > 0 && (
              <div className="px-4 py-2.5 border-b border-white/10">
                <p className="text-[11px] font-semibold text-[#8A8373] uppercase tracking-wide mb-1.5">Hands up</p>
                <div className="flex flex-wrap gap-1.5">
                  {raisedHands.map(p => (
                    <span key={p.uid} className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-1 text-[11px] text-white">
                      <Hand className="w-3 h-3 text-brand" /> {p.name.split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {messages.length === 0 ? (
                <p className="text-[#8A8373] text-[12px]">No questions yet.</p>
              ) : (
                messages.map(m => (
                  <div key={m.id} className="text-[12px]">
                    <span className="font-semibold text-white">{m.users?.full_name || 'Someone'}</span>
                    <p className="text-[#D9D2C4] leading-snug">{m.content}</p>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-white/10 flex gap-2">
              <input
                value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Ask a question…"
                className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-[12px] text-white placeholder-[#8A8373] outline-none"
              />
              <button onClick={send} className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white flex-shrink-0">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
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
        <button
          onClick={toggleHand} disabled={!joined}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition ${handRaised ? 'bg-brand text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          <Hand className="w-[18px] h-[18px]" />
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
