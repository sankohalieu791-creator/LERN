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
        className="w-full bg-white border border-[#E2DDD1] rounded-xl px-4 py-3 text-[15px] text-ink placeholder-[#A39C8A] outline-none focus:border-brand transition"
      />
      {hint && <span className="block text-[13px] text-[#8A8373] mt-1.5">{hint}</span>}
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
      className="w-full bg-brand text-white font-bold text-[15px] py-3.5 rounded-xl hover:bg-[#D95E17] active:scale-[0.99] transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      className="w-full bg-white border border-[#E2DDD1] text-ink font-semibold text-[15px] py-3.5 rounded-xl hover:border-[#C9C2B2] active:scale-[0.99] transition disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="bg-[#FDEEEA] border border-[#F3C9BC] text-[#B3401E] text-sm rounded-xl px-4 py-3 mb-5">
      {message}
    </div>
  )
}
