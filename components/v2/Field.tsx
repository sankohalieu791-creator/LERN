'use client'

export function TextField({
  label, type = 'text', value, onChange, placeholder, required, autoFocus, hint,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  autoFocus?: boolean
  hint?: string
}) {
  return (
    <label className="block mb-5">
      <span className="block text-[13px] font-semibold text-ink mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className="w-full bg-surface border border-edge rounded-xl px-4 py-3 text-[15px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
      />
      {hint && <span className="block text-[13px] text-ink-tertiary mt-1.5">{hint}</span>}
    </label>
  )
}

export function PrimaryButton({
  children, onClick, type = 'button', disabled, loading,
}: {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full bg-brand text-white font-bold text-[15px] py-3.5 rounded-xl hover:bg-brand-hover active:scale-[0.99] transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}

export function SecondaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-surface border border-edge text-ink font-semibold text-[15px] py-3.5 rounded-xl hover:border-edge-input active:scale-[0.99] transition disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex-1 h-px bg-edge" />
      <span className="text-[12px] font-semibold text-ink-quaternary uppercase tracking-wide">or</span>
      <div className="flex-1 h-px bg-edge" />
    </div>
  )
}

export function GoogleButton({ onClick, loading, label = 'Continue with Google' }: { onClick: () => void; loading?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2.5 bg-white border border-edge text-ink font-semibold text-[15px] py-3.5 rounded-xl hover:border-edge-input active:scale-[0.99] transition disabled:opacity-40"
    >
      {loading ? <Spinner /> : (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.68 9c0-.593.102-1.17.284-1.706V4.962H.957A9 9 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A9 9 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z" />
        </svg>
      )}
      {label}
    </button>
  )
}

export function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="bg-danger-bg border border-accent-bg-soft text-danger-text text-sm rounded-xl px-4 py-3 mb-5">
      {message}
    </div>
  )
}
