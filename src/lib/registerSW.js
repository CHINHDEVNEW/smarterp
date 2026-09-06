export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  // In development mode, automatically unregister any stale service worker and clear old caches
  if (!import.meta.env.PROD) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister()
      }
    })
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          if (key.startsWith('smarterp-')) {
            caches.delete(key)
          }
        }
      })
    }
    return
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    window.smartErpInstallPrompt = event
    window.dispatchEvent(new Event('smarterp:install-ready'))
  })
  window.addEventListener('appinstalled', () => {
    window.smartErpInstallPrompt = null
    window.dispatchEvent(new Event('smarterp:installed'))
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        window.smartErpServiceWorker = registration
        if (registration.waiting) window.dispatchEvent(new Event('smarterp:update-ready'))
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new Event('smarterp:update-ready'))
            }
          })
        })
      })
      .catch((error) => {
        console.warn('Không thể bật chế độ cài đặt SmartERP.', error)
      })
  })
}
