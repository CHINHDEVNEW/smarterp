import { useEffect, useState } from 'react'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export default function usePwaInstall() {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [dismissed, setDismissed] = useState(false)
  const ios = isIosDevice()

  useEffect(() => {
    function capturePrompt(event) {
      event.preventDefault()
      setPrompt(event)
    }
    function markInstalled() {
      setInstalled(true)
      setPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', capturePrompt)
    window.addEventListener('appinstalled', markInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt)
      window.removeEventListener('appinstalled', markInstalled)
    }
  }, [])

  async function install() {
    if (!prompt) return false
    await prompt.prompt()
    const result = await prompt.userChoice
    setPrompt(null)
    if (result.outcome === 'accepted') setInstalled(true)
    return result.outcome === 'accepted'
  }

  return {
    canInstall: !installed && !dismissed && (Boolean(prompt) || ios),
    ios,
    install,
    dismiss: () => setDismissed(true),
  }
}
