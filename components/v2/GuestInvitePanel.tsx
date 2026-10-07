'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrgStudents, createGuestInvite, getGuestInvites, revokeGuestInvite } from '@/lib/supabase'
import { Link as LinkIcon, Shield, Copy, Check, Ban, Clock, UserCheck, Search } from 'lucide-react'

// Promoted out of StudentsPanel's third tab into its own screen, 1 Oct
// 2026 -- this is the one place an outside employer touches LERN data
// without ever creating an account, which makes it a distinct enough
// capability (and a distinct enough risk surface -- a revocable,
// single-purpose link out to someone with no account at all) that
// burying it as a secondary tab undersold it. Same component, same
// createGuestInvite/getGuestInvites/revokeGuestInvite backing -- now
// fetching its own roster instead of receiving it from StudentsPanel,
// so it stands on its own. Shared by institution and provider, same as
// Students always was -- driven entirely by the signed-in staff
// member's own organisation_id.
function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function GuestInvitePanel() {
  const { user } = useAuth()
  const [students, setStudents] = useState<any[]>([])
  const [invites, setInvites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [newLink, setNewLink] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const load = () => {
    if (!user?.organisation_id) return
    getOrgStudents(user.organisation_id).then(({ data }) => setStudents(data || []))
    getGuestInvites(user.organisation_id).then(({ data }) => { setInvites(data || []); setLoading(false) })
  }
  useEffect(load, [user?.organisation_id])

  // One student selected by default -- the first time the roster
  // arrives with nothing chosen yet.
  useEffect(() => {
    if (students.length > 0 && selected.size === 0) setSelected(new Set([students[0].id]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students])

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleCreate = async () => {
    setError('')
    if (selected.size === 0) return setError('Select at least one student first.')
    if (!user?.organisation_id) return setError("Your organisation hasn't loaded yet — wait a moment and try again.")
    setCreating(true)
    setNewLink(null)
    const { data, error: err } = await createGuestInvite(user.organisation_id, user.id, Array.from(selected), email)
    setCreating(false)
    if (err || !data) { setError(err?.message || "Couldn't create the invite — try again."); return }
    setNewLink(`${window.location.origin}/guest/${(data as any).token}`)
    setEmail('')
    load()
  }

  const handleRevoke = async (id: string) => {
    setError('')
    const { error: err } = await revokeGuestInvite(id)
    if (err) { setError("Couldn't revoke that link — try again."); return }
    setInvites(prev => prev.map(i => i.id === id ? { ...i, revoked_at: new Date().toISOString() } : i))
  }

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const pendingCount = invites.filter(i => !i.revoked_at && !i.claimed_by).length
  const claimedCount = invites.filter(i => i.claimed_by).length
  const revokedCount = invites.filter(i => i.revoked_at).length

  return (
    <div>
      <p className="text-[18px] font-semibold text-ink">Guest invite</p>
      <p className="text-[13px] mt-0.5 mb-4" style={{ color: '#5A5A5A' }}>
        Share a student's verified work directly with an employer who has no LERN account — no browsing, no sign-up, nothing else exposed.
      </p>

      {invites.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <StatChip icon={Clock} label="Pending" value={pendingCount} color="#854F0B" bg="#FAEEDA" />
          <StatChip icon={UserCheck} label="Claimed" value={claimedCount} color="#0F6E56" bg="#E1F5EE" />
          <StatChip icon={Ban} label="Revoked" value={revokedCount} color="#5F5E5A" bg="#F1EFE8" />
        </div>
      )}

      <div className="bg-surface border border-edge rounded-2xl p-6 mb-5">
        <p className="text-[14px] font-semibold text-ink mb-1.5">Invite an employer</p>
        <p className="text-[12px] mb-5 leading-relaxed" style={{ color: '#5A5A5A' }}>
          Bring in one employer to see a student's verified work. No account, no browsing the rest of LERN. Any interest comes straight back to you.
        </p>

        <p className="text-[12px] font-medium mb-2" style={{ color: '#5A5A5A' }}>Who should they see?</p>
        {students.length === 0 ? (
          <p className="text-[13px] text-ink-tertiary mb-1">No students have joined yet.</p>
        ) : (
          <>
          {students.length > 0 && (
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary pointer-events-none" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search students by name…"
                className="w-full bg-surface border border-edge rounded-lg pl-9 pr-3 py-2 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
              />
            </div>
          )}
          <div className="space-y-1.5 mb-1.5 max-h-72 overflow-y-auto">
            {students
              .filter(s => !search.trim() || s.full_name?.toLowerCase().includes(search.trim().toLowerCase()))
              .map(s => {
              const checked = selected.has(s.id)
              return (
                <button
                  key={s.id} onClick={() => toggle(s.id)}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-surface-muted"
                >
                  <span className={`flex-shrink-0 w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center transition ${checked ? 'bg-ink border-ink' : 'border-edge-input bg-surface'}`}>
                    {checked && <Check className="w-3 h-3 text-paper" strokeWidth={3} />}
                  </span>
                  <span className="flex-1 min-w-0 text-[13px] font-semibold text-ink truncate">{s.full_name}</span>
                  <span className="text-[12px] flex-shrink-0" style={{ color: '#5A5A5A' }}>{s.verified} verified piece{s.verified === 1 ? '' : 's'}</span>
                </button>
              )
            })}
            {search.trim() && students.filter(s => s.full_name?.toLowerCase().includes(search.trim().toLowerCase())).length === 0 && (
              <p className="text-[13px] text-ink-tertiary px-3 py-2">No students match that search.</p>
            )}
          </div>
          </>
        )}
        <p className="text-[11px] mb-5" style={{ color: '#8A8A8A' }}>You can add more than one student if this employer is hiring for a role.</p>

        <label className="block mb-5">
          <span className="block text-[12px] font-medium mb-1.5" style={{ color: '#5A5A5A' }}>Employer's email (optional)</span>
          <input
            value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" type="email"
            className="w-full bg-surface border border-edge rounded-lg px-3.5 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
          />
        </label>

        {error && (
          <div className="bg-danger-bg border border-danger-hover rounded-lg px-3.5 py-2.5 mb-4">
            <p className="text-[12.5px] text-danger-text">{error}</p>
          </div>
        )}

        {newLink && (
          <div className="flex items-center gap-2 bg-success-bg border border-success-text/20 rounded-lg px-3.5 py-2.5 mb-4">
            <p className="text-[12.5px] text-ink flex-1 truncate font-mono">{newLink}</p>
            <button onClick={() => copy(newLink, 'new')} className="text-success-text hover:opacity-70 transition flex-shrink-0">
              {copiedId === 'new' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}

        <button
          onClick={handleCreate} disabled={creating}
          className="w-full flex items-center justify-center gap-1.5 text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-60 transition mb-4"
          style={{ backgroundColor: '#F26B21' }}
        >
          <LinkIcon className="w-4 h-4" /> {creating ? 'Creating…' : 'Create invite link'}
        </button>

        <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3" style={{ backgroundColor: '#E6F1FB' }}>
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#0C447C' }} />
          <p className="text-[12px] leading-relaxed" style={{ color: '#0C447C' }}>
            The guest sees only the students you pick, and only their verified work. You can revoke the link any time.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : invites.length > 0 && (
        <div className="space-y-2">
          {invites.map(inv => {
            const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/guest/${inv.token}`
            const shares = inv.guest_invite_shares || []
            const names = shares.map((s: any) => s.users?.full_name).filter(Boolean)
            const nameLabel = names.length === 0 ? 'Student' : names.length === 1 ? names[0] : `${names[0]} +${names.length - 1} more`
            const status = inv.revoked_at ? 'Revoked' : inv.claimed_by ? 'Claimed' : 'Pending'
            return (
              <div key={inv.id} className="flex items-center justify-between bg-surface border border-edge rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">{nameLabel}</p>
                  <p className="text-[11px] text-ink-tertiary">{status} · {new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {!inv.revoked_at && !inv.claimed_by && (
                    <button onClick={() => copy(link, inv.id)} className="text-ink-secondary hover:text-brand transition">
                      {copiedId === inv.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                  {!inv.revoked_at && (
                    <button onClick={() => handleRevoke(inv.id)} className="text-ink-secondary hover:text-danger-text transition">
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatChip({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: number; color: string; bg: string }) {
  return (
    <div className="bg-surface border border-edge rounded-xl px-3.5 py-3 flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-bold text-ink leading-none">{value}</p>
        <p className="text-[11px] mt-0.5" style={{ color: '#8A8A8A' }}>{label}</p>
      </div>
    </div>
  )
}
