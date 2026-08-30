'use client'

import { useEffect } from 'react'

// Registers /sw.js (push notifications). This was never actually
// called anywhere before, which had two real consequences: push
// notifications had no worker to receive them, and if a browser had
// previously installed the old v1 app as a PWA, that OLD service
// worker could still be sitting there controlling the origin
// indefinitely, since nothing ever told the browser to check for an
// update. Calling register() here makes the browser compare against
// the current /sw.js and take over — the standard fix for a stale,
// orphaned worker from a previous version of the app.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}
