'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getMyOpportunities, createOpportunity, deleteOpportunity } from '@/lib/supabase'
import { Plus, Trash2, Megaphone } from 'lucide-react'

export default function EmployerOpportunitiesPanel() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    if (!user) return
    getMyOpportunities(user.id).then(({ data }) => { setItems(data || []); setLoading(false) })
  }
  useEffect(load, [user])

  const handleCreate = async () => {
    if (!user || !title.trim()) return
    setSaving(true)
    const { error } = await createOpportunity(user.id, { title: title.trim(), description: description.trim() || undefined })
    setSaving(false)
    if (!error) { setTitle(''); setDescription(''); setShowForm(false); load() }
  }

  const handleDelete = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id)) // optimistic
    await deleteOpportunity(id)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-1">Opportunities</h1>
          <p className="text-ink-tertiary text-[14px]">Post jobs, apprenticeships and internships. Responses come in through the Job Tracker.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-brand text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> New opportunity
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-surface border border-edge rounded-2xl p-5 space-y-3">
          <input
            value={title} onChange={e => setTitle(e.target.value)} placeholder="Title — e.g. Junior Video Editor" autoFocus
            className="w-full bg-surface border border-edge rounded-lg px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
          />
          <textarea
            value={description} onChange={e => setDescription(e.target.value)} placeholder="What's the role? What are you looking for?" rows={3}
            className="w-full bg-surface border border-edge rounded-lg px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!title.trim() || saving} className="px-4 py-2 rounded-lg bg-brand text-white text-[13px] font-semibold disabled:opacity-40">
              {saving ? 'Posting…' : 'Post'}
            </button>
            <button onClick={() => { setShowForm(false); setTitle(''); setDescription('') }} className="px-4 py-2 rounded-lg text-ink-secondary text-[13px] font-semibold hover:bg-surface-muted transition">
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
          <p className="font-bold text-ink text-[15px] mb-1.5">No opportunities posted yet</p>
          <p className="text-ink-tertiary text-[14px]">Post your first role to start hearing from interested young people.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map(o => (
            <div key={o.id} className="bg-surface border border-edge rounded-2xl p-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-bold text-ink text-[15px] mb-1">{o.title}</p>
                {o.description && <p className="text-[13px] text-ink-tertiary">{o.description}</p>}
                <p className="text-[11px] text-ink-quaternary mt-2">Posted {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <button onClick={() => handleDelete(o.id)} aria-label="Delete" className="text-ink-tertiary hover:text-danger-text transition flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
