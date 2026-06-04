'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

function PasswordField({
  label, value, onChange, show, onToggle, placeholder = '••••••••',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[#555] theme-text-2 text-xs font-semibold mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#1a1a1a] theme-input border border-[rgba(255,255,255,0.08)] theme-border rounded-xl px-4 py-3 pr-11 text-white theme-text-1 text-sm placeholder-[#333] outline-none focus:border-[rgba(255,255,255,0.2)] transition"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export default function AccountSecurityPage() {
  const { user } = useAuth()

  const [newPass,     setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [success,     setSuccess]     = useState('')
  const [error,       setError]       = useState('')

  const handleChangePassword = async () => {
    setError('')
    setSuccess('')
    if (newPass.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (newPass !== confirmPass) {
      setError('Passwords do not match')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password: newPass })
    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setSuccess('Password updated successfully')
      setNewPass('')
      setConfirmPass('')
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] theme-bg pb-24">

      {/* HEADER */}
      <div className="px-4 py-4 flex items-center gap-3 border-b border-[rgba(255,255,255,0.07)] theme-border sticky top-0 bg-[#0f0f0f] theme-bg z-10">
        <Link href="/settings" className="text-[#888] hover:text-white transition">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-white theme-text-1 font-bold text-lg">Account & security</h1>
      </div>

      {/* ACCOUNT INFO */}
      <div className="px-4 mt-6">
        <p className="text-[#555] theme-text-2 text-[11px] font-bold uppercase tracking-widest mb-3">Account</p>
        <div className="bg-[#1a1a1a] theme-card border border-[rgba(255,255,255,0.07)] theme-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="w-9 h-9 rounded-full bg-[#1e1e1e] flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-[#888]" />
            </div>
            <div className="flex-1">
              <p className="text-[#555] theme-text-2 text-xs">Email address</p>
              <p className="text-white theme-text-1 text-sm font-semibold mt-0.5">{user?.email ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-4 border-t border-[rgba(255,255,255,0.05)] theme-border">
            <div className="w-9 h-9 rounded-full bg-[#1e1e1e] flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-[#888]" />
            </div>
            <div className="flex-1">
              <p className="text-[#555] theme-text-2 text-xs">Account type</p>
              <p className="text-white theme-text-1 text-sm font-semibold mt-0.5 capitalize">
                {user?.account_type ?? 'student'}
                {user?.verified && <span className="ml-2 text-[10px] font-bold text-[#1d9bf0] bg-[#1d9bf0]/10 px-1.5 py-0.5 rounded-full">Verified</span>}
              </p>
            </div>
          </div>
        </div>
        <p className="text-[#444] text-xs mt-2 px-1">To change your email, contact support.</p>
      </div>

      {/* CHANGE PASSWORD */}
      <div className="px-4 mt-8">
        <p className="text-[#555] theme-text-2 text-[11px] font-bold uppercase tracking-widest mb-3">Change password</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-green-400 text-sm">{success}</p>
          </div>
        )}

        <div className="space-y-3">
          <PasswordField
            label="New password"
            value={newPass}
            onChange={setNewPass}
            show={showPass}
            onToggle={() => setShowPass(v => !v)}
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPass}
            onChange={setConfirmPass}
            show={showPass}
            onToggle={() => setShowPass(v => !v)}
          />
        </div>

        <p className="text-[#444] text-xs mt-2 px-1 mb-5">Minimum 6 characters.</p>

        <button
          onClick={handleChangePassword}
          disabled={saving || !newPass || !confirmPass}
          className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 active:scale-[0.98] transition"
        >
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </div>
  )
}
