const DATABASE_NAME = 'smarterp-cache'
const STORE_NAME = 'snapshots'

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function readSnapshot(key) {
  const database = await openDatabase()
  if (!database) return null
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve(request.result?.value ?? null)
    request.onerror = () => reject(request.error)
  })
}

export async function writeSnapshot(key, value) {
  const database = await openDatabase()
  if (!database) return
  await new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({ value, savedAt: Date.now() }, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function withOfflineFallback(key, loader) {
  try {
    const value = await loader()
    writeSnapshot(key, value).catch(() => {})
    return value
  } catch (error) {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    if (offline) {
      const cached = await readSnapshot(key).catch(() => null)
      if (cached !== null) return cached
    }
    throw error
  }
}

