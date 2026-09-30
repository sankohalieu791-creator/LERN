'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Copy, Check, ShieldCheck } from 'lucide-react'
import { enrollTotpFactor, verifyTotpEnrollment } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

// Real TOTP enrollment (Supabase Auth's own native MFA, not a hand-
// rolled secret store) -- scan, confirm with a live code, then save
// the recovery codes once, since that's the only moment they'll ever
// be shown again. Used from both org/employer SettingsPanel and
// StudentSettingsPanel -- one modal, both places.
type Stage = 'intro' | 'qr' | 'recovery' | 'error'

export default function TwoStepSetup({ onClose, onEnabled }: { onClose: () => void; onEnabled: () => void }) {
  const [stage, setStage] = useState<Stage>('intro')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [factorId, setFactorId] = useState('')
  const [qrSvg, setQrSvg] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const start = async () => {
    setLoading(true)
    setError('')
    const { data, error: enrollError } = await enrollTotpFactor()
    setLoading(false)
    if (enrollError || !data) { setError(enrollError?.message || 'Could not start setup — try again.'); setStage('error'); return }
    setFactorId(data.id)
    setQrSvg(data.totp.qr_code)
    setSecret(data.totp.secret)
    setStage('qr')
  }

  const confirm = async () => {
    if (code.trim().length !== 6) return setError('Enter the 6-digit code from your app.')
    setLoading(true)
    setError('')
    const { data, error: verifyError } = await verifyTotpEnrollment(factorId, code.trim())
    setLoading(false)
    if (verifyError || !data) { setError('That code didn’t match — check the time on your phone and try again.'); return }
    setRecoveryCodes(data.recoveryCodes)
    setStage('recovery')
  }

  const cancel = async () => {
    // An enrolled-but-never-verified factor is inert (nothing can
    // challenge against it), but tidying it up now avoids it lingering
    // in listFactors() indefinitely.
    if (factorId && stage === 'qr') await supabase.auth.mfa.unenroll({ factorId }).catch(() => {})
    onClose()
  }

  const copyAll = () => {
    navigator.clipboard?.writeText(recoveryCodes.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return createPortal((
    <div className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5">
          <p className="font-bold text-ink text-[16px]">Two-step verification</p>
          <button onClick={cancel} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-muted transition text-ink-tertiary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {stage === 'intro' && (
            <>
              <div className="w-11 h-11 rounded-full bg-accent-bg flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5 text-brand" />
              </div>
              <p className="text-[13.5px] text-ink-secondary leading-relaxed mb-5">
                You'll need an authenticator app (Google Authenticator, Authy, or your phone's built-in one) to scan a QR code. After that, logging in needs your password and a fresh 6-digit code from that app.
              </p>
              {error && <p className="text-[12.5px] text-danger-text mb-3">{error}</p>}
              <button onClick={start} disabled={loading} className="w-full bg-brand text-white font-bold text-[14px] py-3 rounded-xl hover:bg-brand-hover transition disabled:opacity-50">
                {loading ? 'Starting…' : 'Get started'}
              </button>
            </>
          )}

          {stage === 'qr' && (
            <>
              <p className="text-[13px] text-ink-secondary mb-3">Scan this with your authenticator app:</p>
              <div className="bg-white rounded-xl p-3 mb-3 flex items-center justify-center">
                <img src={qrSvg} alt="Two-step verification QR code" width={180} height={180} />
              </div>
              <p className="text-[11.5px] text-ink-quaternary text-center mb-4 break-all">Can't scan it? Enter this code manually: <span className="font-mono">{secret}</span></p>
              <input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                inputMode="numeric"
                autoFocus
                className="w-full bg-surface-subtle border border-edge rounded-xl px-4 py-3 text-[18px] tracking-[0.3em] text-center text-ink outline-none focus:border-brand transition mb-3"
              />
              {error && <p className="text-[12.5px] text-danger-text mb-3">{error}</p>}
              <button onClick={confirm} disabled={loading || code.length !== 6} className="w-full bg-brand text-white font-bold text-[14px] py-3 rounded-xl hover:bg-brand-hover transition disabled:opacity-40">
                {loading ? 'Checking…' : 'Confirm'}
              </button>
            </>
          )}

          {stage === 'recovery' && (
            <>
              <p className="text-[13.5px] font-semibold text-ink mb-1.5">Save your recovery codes</p>
              <p className="text-[12.5px] text-ink-tertiary leading-relaxed mb-4">
                If you ever lose access to your authenticator app, one of these gets you back in — each works once. This is the only time they'll be shown.
              </p>
              <div className="bg-surface-subtle rounded-xl p-4 mb-3 grid grid-cols-2 gap-2 font-mono text-[13px] text-ink">
                {recoveryCodes.map(c => <span key={c}>{c}</span>)}
              </div>
              <button onClick={copyAll} className="w-full flex items-center justify-center gap-1.5 border border-edge text-ink-secondary text-[13px] font-semibold py-2.5 rounded-xl hover:border-edge-input transition mb-3">
                {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy all</>}
              </button>
              <button onClick={onEnabled} className="w-full bg-brand text-white font-bold text-[14px] py-3 rounded-xl hover:bg-brand-hover transition">
                I've saved these — done
              </button>
            </>
          )}

          {stage === 'error' && (
            <>
              <p className="text-[13px] text-danger-text mb-4">{error}</p>
              <button onClick={start} className="w-full bg-brand text-white font-bold text-[14px] py-3 rounded-xl hover:bg-brand-hover transition">Try again</button>
            </>
          )}
        </div>
      </div>
    </div>
  ), document.body)
}
