import type { NetflixItem, PopularRow } from "./types"
import { getLocalPoster } from "./poster-map"

const TMDB_BASE = "https://api.themoviedb.org/3"
const TMDB_IMAGE_BASE = "/api/image?size=w342&path="

// Simple in-memory TTL cache for TMDB search results
type CacheEntry = { at: number; value: any }
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
;(global as any).__v0_tmdb_cache = (global as any).__v0_tmdb_cache || new Map<string, CacheEntry>()
const TMDB_CACHE: Map<string, CacheEntry> = (global as any).__v0_tmdb_cache

// Very light concurrency limiter (no external deps)
const MAX_CONCURRENT = 5
;(global as any).__v0_tmdb_inflight = (global as any).__v0_tmdb_inflight || { count: 0, q: [] as Array<() => void> }
const inflight: { count: number; q: Array<() => void> } = (global as any).__v0_tmdb_inflight
function acquire(): Promise<void> {
  return new Promise((resolve) => {
    if (inflight.count < MAX_CONCURRENT) {
      inflight.count++
      resolve()
    } else {
      inflight.q.push(() => {
        inflight.count++
        resolve()
      })
    }
  })
}
function release() {
  inflight.count = Math.max(0, inflight.count - 1)
  const next = inflight.q.shift()
  if (next) next()
}

// Rate-limited miss logging
;(global as any).__v0_tmdb_miss = (global as any).__v0_tmdb_miss || { last: 0, n: 0 }
;(global as any).__v0_tmdb_miss_map = (global as any).__v0_tmdb_miss_map || new Map<string, { count: number; lastAt: number }>()
const missState: { last: number; n: number } = (global as any).__v0_tmdb_miss
const missMap: Map<string, { count: number; lastAt: number }> = (global as any).__v0_tmdb_miss_map
function logMiss(title: string) {
  const now = Date.now()
  if (now - missState.last > 1000) {
    missState.last = now
    missState.n = 0
  }
  if (missState.n < 5) {
    console.warn("[v0] TMDB poster miss:", title)
    missState.n++
  }
  const rec = missMap.get(title) || { count: 0, lastAt: 0 }
  rec.count += 1
  rec.lastAt = now
  missMap.set(title, rec)
}

function normalizeToken(raw?: string | null): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "")
  return trimmed.startsWith("Bearer ") ? trimmed.slice(7).trim() : trimmed
}

function normalizeQuery(title: string): string {
  // 시즌/파트/숫자 표기 제거, 괄호 내부 제거 등 간단 정규화
  let t = title
  t = t.replace(/\bS\d+\b/gi, " ") // S2, S10
  t = t.replace(/\bSeason\s*\d+\b/gi, " ") // Season 2
  t = t.replace(/\bPart\s*\d+\b/gi, " ") // Part 2
  t = t.replace(/파트\s*\d+/g, " ") // 파트 2
  t = t.replace(/시즌\s*\d+/g, " ") // 시즌 2
  // common sequel markers
  t = t.replace(/:\s*(Chapter|Episode|Ep|Part)\s*\d+/gi, " ")
  t = t.replace(/-\s*(Chapter|Episode|Ep|Part)\s*\d+/gi, " ")
  // roman numerals like II, III
  t = t.replace(/\b(II|III|IV|V|VI|VII|VIII|IX|X)\b/gi, " ")
  // trailing numerals like " 2" or " 3"
  t = t.replace(/\s+\d+$/g, " ")
  t = t.replace(/\([^\)]*\)/g, " ") // 괄호 내용 제거
  t = t.replace(/[\[\]『』〈〉]/g, " ")
  t = t.replace(/\s{2,}/g, " ").trim()
  return t
}

function variantQueries(title: string): string[] {
  const base = normalizeQuery(title)
  const variants = new Set<string>([title, base])
  // Replace ampersand with 'and'
  variants.add(base.replace(/\s*&\s*/g, " and "))
  // Remove punctuation
  variants.add(base.replace(/[!?:;,.]/g, " ").replace(/\s{2,}/g, " ").trim())
  // Shorten long subtitles after dash/colon
  variants.add(base.replace(/[\-:].*$/, "").trim())
  return Array.from(variants).filter(Boolean)
}

async function doSearchOnce(query: string, language: string, endpoint: "multi" | "movie" | "tv") {
  const v4 = normalizeToken(process.env.TMDB_API_KEY)
  const v3 = normalizeToken(process.env.TMDB_API_KEY_V3)
  if (!v4 && !v3) {
    console.warn("[v0] TMDB key missing; skip enrichment")
    return null
  }

  const cacheKey = `${endpoint}|${language}|${query}`
  const hit = TMDB_CACHE.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.value
  }

  // Prefer v4 Bearer; fallback to v3 api_key
  const baseUrl = `${TMDB_BASE}/search/${endpoint}?query=${encodeURIComponent(query)}&language=${encodeURIComponent(language)}&include_adult=false`
  const url = v3 ? `${baseUrl}&api_key=${encodeURIComponent(v3)}` : baseUrl
  await acquire()
  try {
    // First attempt: prefer v4 Bearer
    const res = await fetch(url, {
      headers: v4
        ? {
            Authorization: `Bearer ${v4}`,
            Accept: "application/json",
          }
        : { Accept: "application/json" },
      cache: "no-store",
    } as any)
    if (!res.ok) {
      // Retry once for rate limit/server errors
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 300))
        const resRetry = await fetch(url, {
          headers: v4
            ? { Authorization: `Bearer ${v4}`, Accept: "application/json" }
            : { Accept: "application/json" },
          cache: "no-store",
        } as any)
        if (resRetry.ok) {
          const dataR = await resRetry.json()
          const resultR = (dataR?.results || [])[0]
          if (resultR) {
            TMDB_CACHE.set(cacheKey, { at: Date.now(), value: resultR })
            return resultR
          }
        }
      }
      const text = await res.text().catch(() => "")
      console.warn(
        "[v0] TMDB search failed",
        res.status,
        res.statusText,
        "auth:",
        v4 ? "v4" : v3 ? "v3" : "none",
        text ? `body: ${text.slice(0, 200)}` : ""
      )
      // If v4 failed with 401 and we have v3, retry once using v3 only (no Authorization header)
      if (res.status === 401 && v3) {
        const retryUrl = `${TMDB_BASE}/search/${endpoint}?query=${encodeURIComponent(query)}&language=${encodeURIComponent(language)}&include_adult=false&api_key=${encodeURIComponent(v3)}`
        const res2 = await fetch(retryUrl, { headers: { Accept: "application/json" }, cache: "no-store" } as any)
        if (!res2.ok) {
          const text2 = await res2.text().catch(() => "")
          console.warn("[v0] TMDB retry(v3) failed", res2.status, res2.statusText, text2 ? `body: ${text2.slice(0, 200)}` : "")
          return null
        }
        const data2 = await res2.json()
        const result2 = (data2?.results || [])[0]
        if (!result2) return null
        TMDB_CACHE.set(cacheKey, { at: Date.now(), value: result2 })
        return result2
      }
      return null
    }
    const data = await res.json()
    const result = (data?.results || [])[0]
    if (!result) return null
    TMDB_CACHE.set(cacheKey, { at: Date.now(), value: result })
    return result
  } catch (e) {
    console.warn("[v0] TMDB fetch error", e)
    return null
  } finally {
    release()
  }
}

async function searchTMDB(title: string, hint?: { category?: string }) {
  const langs = ["ko-KR", "en-US"]
  const queries = variantQueries(title)
  const endpoints: ("movie" | "tv" | "multi")[] = []
  if (hint?.category === "Films") endpoints.push("movie", "multi")
  else if (hint?.category === "TV") endpoints.push("tv", "multi")
  else endpoints.push("multi")

  for (const endpoint of endpoints) {
    for (const lang of langs) {
      for (const q of queries) {
        try {
          const result = await doSearchOnce(q, lang, endpoint)
          if (result) return result
        } catch {}
      }
    }
  }
  return null
}

export async function enrichNetflixItems(items: NetflixItem[], limit = 40): Promise<NetflixItem[]> {
  const enriched: NetflixItem[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (i < limit) {
      try {
        const result = await searchTMDB(item.title, { category: item.category })
        if (result) {
          const posterUrl = result.poster_path
            ? `${TMDB_IMAGE_BASE}${encodeURIComponent(result.poster_path)}`
            : result.backdrop_path
            ? `/api/image?size=w780&path=${encodeURIComponent(result.backdrop_path)}`
            : undefined
          enriched.push({
            ...item,
            poster: posterUrl || item.poster || getLocalPoster(item.title),
            title: result.title || result.name || result.original_title || result.original_name || item.title,
          })
          continue
        }
      } catch {}
    }
    logMiss(item.title)
    enriched.push({ ...item, poster: item.poster || getLocalPoster(item.title) })
  }
  return enriched
}

export async function enrichPopularRows(rows: PopularRow[], limit = 40): Promise<PopularRow[]> {
  const out: PopularRow[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (i < limit) {
      try {
        const result = await searchTMDB(row.title, { category: row.category })
        if (result) {
          const posterUrl = result.poster_path
            ? `${TMDB_IMAGE_BASE}${encodeURIComponent(result.poster_path)}`
            : result.backdrop_path
            ? `/api/image?size=w780&path=${encodeURIComponent(result.backdrop_path)}`
            : undefined
          out.push({
            ...row,
            poster: posterUrl || getLocalPoster(row.title),
            localizedTitle: result.title || result.name || result.original_title || result.original_name,
          })
          continue
        }
      } catch {}
    }
    logMiss(row.title)
    out.push({ ...row, poster: getLocalPoster(row.title) })
  }
  return out
}
