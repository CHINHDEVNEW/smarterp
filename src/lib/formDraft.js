const PREFIX = 'smarterp:form-draft'

export function formDraftKey(businessId, formName) {
  return businessId ? `${PREFIX}:${businessId}:${formName}` : ''
}

export function loadFormDraft(key) {
  if (!key || typeof window === 'undefined') return null
  try {
    const value = window.sessionStorage.getItem(key)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export function saveFormDraft(key, value) {
  if (!key || typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Draft persistence is best-effort and must never block data entry.
  }
}

export function clearFormDraft(key) {
  if (!key || typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Ignore unavailable storage.
  }
}

export function hasFormDraft(key) {
  if (!key || typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(key) !== null
  } catch {
    return false
  }
}

export function clearAllFormDrafts() {
  if (typeof window === 'undefined') return
  try {
    const keys = []
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index)
      if (key?.startsWith(`${PREFIX}:`)) keys.push(key)
    }
    keys.forEach((key) => window.sessionStorage.removeItem(key))
  } catch {
    // Ignore unavailable storage.
  }
}
