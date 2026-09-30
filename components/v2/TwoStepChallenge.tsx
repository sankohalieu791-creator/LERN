'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { verifyTotpChallenge, recoverWithCode } from '@/lib/supabase'
import { ErrorBanner, PrimaryButton } from '@/components/v2/Field'

// Shown after a correct password when getAuthenticatorAssuranceLevel()
// says the session still needs a second factor -- the actual, real
// gate (checked in AuthContext, not just this screen's own state), so
// there's no route someone can navigate to that skips this once it's
// required.
export default function TwoStepChallenge({ factorId, onVerified }: { factorId: string; onVerified: () => void }) {
  const [mode, setMode] = useState<'code' | 'recovery'>('code')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [recovered, setRecovered] = useState(false)

  const submitCode = async () => {
    if (code.trim().length !== 6) return setError('Enter the 6-digit code from your authenticator app.')
    setLoading(true)
    setError('')
    const { error: verifyError } = await verifyTotpChallenge(factorId, code.trim())
    setLoading(false)
    if (verifyError) { setError('That code didn’t match — check the time on your phone and try again.'); return }
    onVerified()
  }

  const submitRecovery = async () => {
    if (!code.trim()) return setError('Enter a recovery code.')
    setLoading(true)
    setError('')
    const { error: recoverError } = await recoverWithCode(code.trim())
    setLoading(false)
    if (recoverError) { setError(recoverError.message); return }
    setRecovered(true)
    setTimeout(onVerified, 1800)
  }

  if (recovered) {
    return (
      <div className="text-center py-4">
        <div className="w-11 h-11 rounded-full bg-accent-bg flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-5 h-5 text-brand" />
        </div>
        <p className="font-bold text-ink text-[15px] mb-1.5">You're back in</p>
        <p className="text-[13px] text-ink-tertiary leading-relaxed">Your two-step verification was reset — set it up again from Settings when you get a chance.</p>
      </div>
    )
  }

  return (
    <div>
      <ErrorBanner message={error} />
      {mode === 'code' ? (
        <>
          <input
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
            placeholder="6-digit code"
            inputMode="numeric"
            autoFocus
            className="w-full bg-white border border-edge rounded-xl px-4 py-3.5 text-[18px] tracking-[0.3em] text-center text-ink outline-none focus:border-brand transition mb-4"
          />
          <PrimaryButton onClick={submitCode} loading={loading}>Verify</PrimaryButton>
          <button
            onClick={() => { setMode('recovery'); setCode(''); setError('') }}
            className="block w-full text-center text-[13px] font-semibold text-[#8A8373] hover:text-ink transition mt-4"
          >
            Lost your device? Use a recovery code
          </button>
        </>
      ) : (
        <>
          <input
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase().slice(0, 10)); setError('') }}
            placeholder="Recovery code"
            autoFocus
            className="w-full bg-white border border-edge rounded-xl px-4 py-3.5 text-[16px] tracking-[0.15em] text-center text-ink font-mono outline-none focus:border-brand transition mb-4"
          />
          <PrimaryButton onClick={submitRecovery} loading={loading}>Verify</PrimaryButton>
          <button
            onClick={() => { setMode('code'); setCode(''); setError('') }}
            className="block w-full text-center text-[13px] font-semibold text-[#8A8373] hover:text-ink transition mt-4"
          >
            Back to authenticator code
          </button>
        </>
      )}
    </div>
  )
}
