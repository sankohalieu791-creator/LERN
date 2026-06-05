// Service worker — handles push notifications and notification clicks

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'LERN', {
      body:  data.body  ?? '',
      icon:  '/images/IMG_0400.PNG',
      badge: '/images/IMG_0400.PNG',
      tag:   data.tag   ?? 'lern-notif',
      renotify: true,
      data:  { url: data.url ?? '/feed' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = event.notification.data?.url ?? '/feed'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        const existing = list.find(c => c.url.includes(self.location.origin) && 'focus' in c)
        if (existing) {
          existing.focus()
          existing.navigate(target)
        } else if (clients.openWindow) {
          clients.openWindow(target)
        }
      })
  )
})
