function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function registerPushSubscription(userId: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
    }))

    const p256dhKey = sub.getKey('p256dh')
    const authKey   = sub.getKey('auth')
    if (!p256dhKey || !authKey) return

    const p256dh = btoa(String.fromCharCode(...new Uint8Array(p256dhKey)))
    const auth   = btoa(String.fromCharCode(...new Uint8Array(authKey)))

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, endpoint: sub.endpoint, p256dh, auth }),
    })
  } catch (err) {
    // Silently ignore — push is non-critical
    console.warn('[push] registration failed:', err)
  }
}

export async function sendPush(
  targetUserId: string,
  title: string,
  body: string,
  url = '/feed'
): Promise<void> {
  try {
    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, title, body, url }),
    })
  } catch {
    // Non-critical — don't surface to user
  }
}
