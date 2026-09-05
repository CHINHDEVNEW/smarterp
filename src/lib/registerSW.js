export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

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
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
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
