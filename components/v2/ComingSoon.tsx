'use client'

export default function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <div className="bg-surface border border-edge rounded-2xl p-10 max-w-3xl flex flex-col items-center text-center">
      <p className="font-bold text-ink text-[16px] mb-1.5">{title}</p>
      <p className="text-ink-tertiary text-[14px]">{note || 'Coming soon.'}</p>
    </div>
  )
}
