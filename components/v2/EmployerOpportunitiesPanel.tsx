'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getMyOpportunities, createOpportunity, updateOpportunity, closeOpportunity, reopenOpportunity, deleteOpportunity } from '@/lib/supabase'
import { useAvatarUrl } from '@/lib/useAvatarUrl'
import { Plus, Trash2, Megaphone, Pencil, Lock, RotateCcw } from 'lucide-react'

type OppType = 'job' | 'apprenticeship' | 'internship'
const TYPE_LABEL: Record<OppType, string> = { job: 'Job', apprenticeship: 'Apprenticeship', internship: 'Internship' }

export default function EmployerOpportunitiesPanel() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<OppType>('job')
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [salary, setSalary] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const avatarUrl = useAvatarUrl(user?.avatar_path)

  const load = () => {
    if (!user) return
    getMyOpportunities(user.id).then(({ data }) => { setItems(data || []); setLoading(false) })
  }
  useEffect(load, [user])

  const reset = () => {
    setTitle(''); setDescription(''); setRequirements(''); setSalary(''); setLocation(''); setType('job'); setShowForm(false); setEditingId(null)
  }

  const startEdit = (o: any) => {
    setEditingId(o.id)
    setTitle(o.title || ''); setType(o.type || 'job'); setDescription(o.description || '')
    setRequirements(o.requirements || ''); setSalary(o.salary || ''); setLocation(o.location || '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!user || !title.trim()) return
    setSaving(true)
    const fields = {
      title: title.trim(), type, description: description.trim() || undefined,
      requirements: requirements.trim() || undefined, salary: salary.trim() || undefined,
      location: location.trim() || undefined,
    }
    const { error } = editingId ? await updateOpportunity(editingId, fields) : await createOpportunity(user.id, fields)
    setSaving(false)
    if (!error) { reset(); load() }
  }

  const handleDelete = async (id: string) => {
    const removed = items.find(i => i.id === id)
    setItems(prev => prev.filter(i => i.id !== id)) // optimistic
    // Was discarding the result before -- a failed delete left the
    // posting removed from this list forever while it was still fully
    // live and gathering applications, with nothing ever putting it back.
    const { error } = await deleteOpportunity(id)
    if (error && removed) {
      setItems(prev => prev.some(i => i.id === id) ? prev : [...prev, removed])
      alert("Couldn't delete that posting — try again.")
    }
  }

  const handleToggleClosed = async (o: any) => {
    setItems(prev => prev.map(i => i.id === o.id ? { ...i, closed_at: o.closed_at ? null : new Date().toISOString() } : i)) // optimistic
    const { error } = o.closed_at ? await reopenOpportunity(o.id) : await closeOpportunity(o.id)
    if (error) load() // revert by refetching real state
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-1">Jobs</h1>
          <p className="text-ink-tertiary text-[14px]">Post jobs, apprenticeships and internships. Responses come in through Candidates.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-brand text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Post a job
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-surface border border-edge rounded-2xl p-5 space-y-3">
          <p className="text-[13px] font-semibold text-ink-secondary">{editingId ? 'Edit posting' : 'New posting'}</p>
          <input
            value={title} onChange={e => setTitle(e.target.value)} placeholder="Title — e.g. Junior Video Editor" autoFocus
            className="w-full bg-surface border border-edge rounded-lg px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
          />

          <div className="flex gap-2">
            {(['job', 'apprenticeship', 'internship'] as OppType[]).map(t => (
              <button
                key={t} onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition ${type === t ? 'bg-brand text-white' : 'bg-surface border border-edge text-ink-secondary'}`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              value={salary} onChange={e => setSalary(e.target.value)} placeholder="Salary — e.g. £22,000–£24,000"
              className="w-full bg-surface border border-edge rounded-lg px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
            />
            <input
              value={location} onChange={e => setLocation(e.target.value)} placeholder="Location — e.g. Manchester or Remote"
              className="w-full bg-surface border border-edge rounded-lg px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
            />
          </div>

          <textarea
            value={description} onChange={e => setDescription(e.target.value)} placeholder="What's the role?" rows={3}
            className="w-full bg-surface border border-edge rounded-lg px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none"
          />
          <textarea
            value={requirements} onChange={e => setRequirements(e.target.value)} placeholder="What are you looking for? Skills, experience, anything essential." rows={3}
            className="w-full bg-surface border border-edge rounded-lg px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none"
          />

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!title.trim() || saving} className="px-4 py-2 rounded-lg bg-brand text-white text-[13px] font-semibold disabled:opacity-40">
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Post'}
            </button>
            <button onClick={reset} className="px-4 py-2 rounded-lg text-ink-secondary text-[13px] font-semibold hover:bg-surface-muted transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : items.length === 0 && !showForm ? (
        <div className="bg-surface border border-edge rounded-2xl p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-accent-bg flex items-center justify-center mb-3">
            <Megaphone className="w-5 h-5 text-brand" />
          </div>
          <p className="font-bold text-ink text-[15px] mb-1.5">No jobs posted yet</p>
          <p className="text-ink-tertiary text-[14px]">Post your first role to start hearing from interested young people.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map(o => (
            <div key={o.id} className={`bg-surface border border-edge rounded-2xl p-5 flex items-start gap-4 ${o.closed_at ? 'opacity-60' : ''}`}>
              {/* No separate per-posting logo any more -- your own
                  profile picture (Settings) is the identity every
                  posting shows, same as every other card in the app. */}
              <div className="w-11 h-11 rounded-xl bg-surface-subtle border border-edge flex items-center justify-center flex-shrink-0 overflow-hidden">
                {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <Megaphone className="w-4 h-4 text-ink-quaternary" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-bold text-ink text-[15px] truncate">{o.title}</p>
                  {o.type && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-muted text-ink-tertiary flex-shrink-0">{TYPE_LABEL[o.type as OppType] || o.type}</span>}
                  {o.closed_at && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-muted text-ink-tertiary flex-shrink-0">Closed</span>}
                </div>
                <p className="text-[12px] text-ink-tertiary">
                  {[o.salary, o.location].filter(Boolean).join(' · ')}
                </p>
                {o.description && <p className="text-[13px] text-ink-secondary mt-1.5">{o.description}</p>}
                {o.requirements && <p className="text-[12.5px] text-ink-tertiary mt-1"><span className="font-semibold">Looking for: </span>{o.requirements}</p>}
                <p className="text-[11px] text-ink-quaternary mt-2">Posted {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => startEdit(o)} aria-label="Edit" className="text-ink-tertiary hover:text-brand transition p-1">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleToggleClosed(o)} aria-label={o.closed_at ? 'Reopen' : 'Close'} className="text-ink-tertiary hover:text-brand transition p-1">
                  {o.closed_at ? <RotateCcw className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>
                <button onClick={() => handleDelete(o.id)} aria-label="Delete" className="text-ink-tertiary hover:text-danger-text transition p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
