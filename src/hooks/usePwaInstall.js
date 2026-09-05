import { useEffect, useState } from 'react'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export default function usePwaInstall() {
  const [prompt, setPrompt] = useState(() => window.smartErpInstallPrompt ?? null)
  const [installed, setInstalled] = useState(isStandalone)
  const [dismissed, setDismissed] = useState(false)
  const ios = isIosDevice()

  useEffect(() => {
    function capturePrompt() { setPrompt(window.smartErpInstallPrompt ?? null) }
    function markInstalled() {
      setInstalled(true)
      setPrompt(null)
    }
    window.addEventListener('smarterp:install-ready', capturePrompt)
    window.addEventListener('smarterp:installed', markInstalled)
    return () => {
      window.removeEventListener('smarterp:install-ready', capturePrompt)
      window.removeEventListener('smarterp:installed', markInstalled)
    }
  }, [])

  async function install() {
    if (!prompt) return false
    await prompt.prompt()
    const result = await prompt.userChoice
    window.smartErpInstallPrompt = null
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
