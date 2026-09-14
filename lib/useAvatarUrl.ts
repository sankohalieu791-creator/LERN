'use client'

import { useEffect, useState } from 'react'
import { getAvatarSignedUrl } from '@/lib/supabase'

// Replaces the old synchronous getAvatarUrl() now that avatars resolve
// to a signed (not permanent public) URL, which needs a network round
// trip -- every call site that used to do `getAvatarUrl(path)` inline
// now calls this hook instead. Cancels stale in-flight requests so a
// fast path change (e.g. scrolling a list) can't land an old avatar's
// URL after the component's moved on to a different path.
export function useAvatarUrl(path?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!path) { setUrl(null); return }
    getAvatarSignedUrl(path).then(resolved => { if (!cancelled) setUrl(resolved) })
    return () => { cancelled = true }
  }, [path])

  return url
}
