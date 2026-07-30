import { User } from 'lucide-react'

// Single shared avatar treatment used everywhere a user's photo appears.
// No photo -> a plain neutral circle with a person icon, not a colored
// gradient + initial letter (that read as decorative/unfinished rather
// than a deliberate "no photo" state).
export default function Avatar({
  url, size = 40, className = '',
}: {
  url?: string | null
  size?: number
  className?: string
}) {
  return (
    <div
      className={`rounded-full bg-[#252525] flex items-center justify-center overflow-hidden flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {url
        ? <img src={url} alt="" className="w-full h-full object-cover" />
        : <User className="text-[#666]" style={{ width: size * 0.5, height: size * 0.5 }} />
      }
    </div>
  )
}
