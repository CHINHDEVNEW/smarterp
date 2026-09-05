export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
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
