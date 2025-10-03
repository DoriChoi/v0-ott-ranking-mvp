// Minimal in-memory cache with TTL for demo purposes

type Entry = { value: any; expiresAt: number }
const store = new Map<string, Entry>()

export async function cacheSet(key: string, value: any, ttlSeconds: number) {
  const expiresAt = Date.now() + ttlSeconds * 1000
  store.set(key, { value, expiresAt })
}

export async function cacheGet<T = any>(key: string): Promise<T | null> {
  const e = store.get(key)
  if (!e) return null
  if (Date.now() > e.expiresAt) {
    store.delete(key)
    return null
  }
  return e.value as T
}
