'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Check, Loader2, Building2, ChevronLeft, Briefcase, Clock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getEmployerDiscoverableUsers, getAllOrganisations, getOrgMembers, expressEmployerInterest, getMyExpressedInterest } from '@/lib/supabase'

type Tab = 'users' | 'orgs' | 'received'

function Avatar({ url, name, size = 52 }: { url?: string | null; name?: string; size?: number }) {
  return (
    <div className="rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {url ? <img src={url} alt={name} className="w-full h-full object-cover" /> : (name?.[0]?.toUpperCase() ?? '?')}
    </div>
  )
}

function VerifiedTick() {
  return (
    <span className="inline-flex items-center justify-center bg-[#1d9bf0] rounded-full flex-shrink-0" style={{ width: 14, height: 14 }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 8, height: 8 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
}

function UserCard({ u, onExpressInterest }: { u: any; onExpressInterest: () => void }) {
  const router = useRouter()
  return (
    <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <button onClick={() => router.push(`/profile/${u.id}`)} className="flex-shrink-0">
          <Avatar url={u.avatar_url} name={u.username} />
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => router.push(`/profile/${u.id}`)} className="flex items-center gap-1">
            <p className="text-white font-bold text-sm truncate">{u.username}</p>
            {u.verified && <VerifiedTick />}
          </button>
          {u.title && <p className="text-[#888] text-xs mt-0.5 truncate">{u.title}</p>}
          {!!u.skills?.length && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {u.skills.slice(0, 4).map((s: string) => (
                <span key={s} className="text-[10px] font-semibold bg-[#252525] text-[#888] px-2 py-0.5 rounded-full">{s}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onExpressInterest}
        className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white text-sm font-bold py-2.5 rounded-xl active:scale-[0.98] transition"
      >
        Express interest
      </button>
    </div>
  )
}

function InterestSheet({ target, onClose, onSent }: { target: any; onClose: () => void; onSent: () => void }) {
  const { user } = useAuth() as any
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [routedToOrg, setRoutedToOrg] = useState(false)

  const handleSend = async () => {
    if (!user || !message.trim()) return
    setSending(true)
    const { error, routedToOrgAdmin } = await expressEmployerInterest(user.id, target.id, message.trim())
    setSending(false)
    if (!error) {
      setRoutedToOrg(!!routedToOrgAdmin)
      setSent(true)
      onSent()
      setTimeout(onClose, 2200)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!sent ? onClose : undefined} />
      <div className="relative bg-[#141414] rounded-t-3xl overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-[#333] rounded-full" /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.07)]">
          <h2 className="text-white font-bold text-lg">Express interest</h2>
          <button onClick={onClose} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="mx-5 mt-4 mb-4 flex items-center gap-3 bg-[#1e1e1e] border border-[rgba(255,255,255,0.07)] rounded-2xl p-3">
          <Avatar url={target.avatar_url} name={target.username} size={44} />
          <div>
            <p className="text-white font-bold text-sm">{target.username}</p>
            {target.title && <p className="text-[#888] text-xs">{target.title}</p>}
          </div>
        </div>

        {sent ? (
          <div className="px-5 pb-10 text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-white" />
            </div>
            <p className="text-white font-bold text-lg">Interest sent!</p>
            <p className="text-[#555] text-sm mt-1 px-4">
              {routedToOrg
                ? `${target.username} belongs to an organisation, so their admin was notified first — this keeps contact safe.`
                : `${target.username} will be notified directly.`}
            </p>
          </div>
        ) : (
          <div className="px-5 pb-6">
            <p className="text-[#555] text-[11px] font-bold uppercase tracking-widest mb-2">Message</p>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={`Tell ${target.username} (or their organisation) why you're interested…`}
              rows={4}
              className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3.5 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition resize-none mb-5"
            />
            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EmployerDiscovery() {
  const { user } = useAuth() as any
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [openOrg, setOpenOrg] = useState<any | null>(null)
  const [orgMembers, setOrgMembers] = useState<any[]>([])
  const [received, setReceived] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [interestTarget, setInterestTarget] = useState<any | null>(null)

  useEffect(() => {
    if (tab !== 'users') return
    setLoading(true)
    getEmployerDiscoverableUsers().then(({ data }) => { setUsers(data ?? []); setLoading(false) })
  }, [tab])

  useEffect(() => {
    if (tab !== 'received' || !user) return
    setLoading(true)
    getMyExpressedInterest(user.id).then(({ data }) => { setReceived(data ?? []); setLoading(false) })
  }, [tab, user])

  useEffect(() => {
    if (tab !== 'orgs') return
    setLoading(true)
    getAllOrganisations().then(({ data }) => { setOrgs(data ?? []); setLoading(false) })
  }, [tab])

  const openOrgRoster = async (org: any) => {
    setOpenOrg(org)
    setLoading(true)
    const { data } = await getOrgMembers(org.id)
    setOrgMembers(data ?? [])
    setLoading(false)
  }

  return (
    <>
    <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <h1 className="text-white text-2xl font-bold mb-1">Discover</h1>
        <p className="text-[#555] text-xs mb-3">Browse verified profiles and express interest — safely, with organisations in the loop.</p>
        <div className="flex gap-2">
          {([
            { id: 'users' as const, label: 'Users' },
            { id: 'orgs'  as const, label: 'Organisations' },
            { id: 'received' as const, label: 'Interest Received' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setOpenOrg(null) }}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition ${
                tab === t.id ? 'bg-white text-black' : 'bg-[#1a1a1a] text-[#888] border border-[rgba(255,255,255,0.08)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 space-y-3 pt-1"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-[#444] animate-spin" /></div>
        ) : tab === 'users' ? (
          users.length === 0 ? (
            <div className="text-center py-16">
              <Briefcase className="w-10 h-10 text-[#2a2a2a] mx-auto mb-3" />
              <p className="text-[#444] text-sm">No independent adult profiles yet</p>
              <p className="text-[#333] text-xs mt-1">Students under 18 or in an organisation appear under Organisations instead</p>
            </div>
          ) : (
            users.map(u => <UserCard key={u.id} u={u} onExpressInterest={() => setInterestTarget(u)} />)
          )
        ) : tab === 'received' ? (
          received.length === 0 ? (
            <div className="text-center py-16">
              <Clock className="w-10 h-10 text-[#2a2a2a] mx-auto mb-3" />
              <p className="text-[#444] text-sm">No interest sent yet</p>
              <p className="text-[#333] text-xs mt-1">Interest you express from Users or Organisations shows up here with its status</p>
            </div>
          ) : (
            received.map((r: any) => (
              <div key={r.id} className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar url={r.target?.avatar_url} name={r.target?.username} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{r.target?.username ?? 'Unknown'}</p>
                    <p className="text-[#555] text-xs">{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                    r.status === 'accepted' ? 'bg-green-500/15 text-green-400'
                    : r.status === 'declined' ? 'bg-[#252525] text-[#555]'
                    : 'bg-yellow-500/10 text-yellow-500'
                  }`}>
                    {r.status === 'accepted' ? '✓ Accepted' : r.status === 'declined' ? '✕ Declined' : '⏳ Pending'}
                  </span>
                </div>
                <p className="text-[#888] text-sm bg-[#111] rounded-xl px-3 py-2.5 leading-relaxed">{r.message}</p>
              </div>
            ))
          )
        ) : openOrg ? (
          <>
            <button onClick={() => setOpenOrg(null)} className="flex items-center gap-1.5 text-[#888] text-sm mb-2">
              <ChevronLeft className="w-4 h-4" /> Back to organisations
            </button>
            <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4 mb-1 flex items-center gap-3">
              {openOrg.logo_url
                ? <img src={openOrg.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-10 h-10 rounded-xl bg-[#252525] flex items-center justify-center flex-shrink-0"><Building2 className="w-5 h-5 text-[#888]" /></div>
              }
              <div>
                <p className="text-white font-bold text-sm">{openOrg.name}</p>
                <p className="text-[#555] text-xs">{orgMembers.length} member{orgMembers.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            {orgMembers.length === 0 ? (
              <p className="text-center text-[#444] text-sm py-10">No members yet</p>
            ) : (
              orgMembers.map((m: any) => (
                <UserCard key={m.user_id} u={m.users} onExpressInterest={() => setInterestTarget(m.users)} />
              ))
            )}
          </>
        ) : orgs.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-10 h-10 text-[#2a2a2a] mx-auto mb-3" />
            <p className="text-[#444] text-sm">No organisations yet</p>
          </div>
        ) : (
          orgs.map(org => (
            <button
              key={org.id}
              onClick={() => openOrgRoster(org)}
              className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.98] transition"
            >
              {org.logo_url
                ? <img src={org.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-xl bg-[#252525] flex items-center justify-center flex-shrink-0"><Building2 className="w-5 h-5 text-[#888]" /></div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{org.name}</p>
                <p className="text-[#555] text-xs mt-0.5">Tap to view student profiles</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>

    {interestTarget && (
      <InterestSheet target={interestTarget} onClose={() => setInterestTarget(null)} onSent={() => {}} />
    )}
    </>
  )
}
