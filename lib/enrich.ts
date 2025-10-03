import type { NetflixItem, PopularRow } from "./types"
import { getLocalPoster } from "./poster-map"

const TMDB_BASE = "https://api.themoviedb.org/3"
const TMDB_IMAGE_BASE = "/api/image?size=w342&path="

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

async function doSearchOnce(query: string, language: string) {
  const v4 = normalizeToken(process.env.TMDB_API_KEY)
  const v3 = normalizeToken(process.env.TMDB_API_KEY_V3)
  if (!v4 && !v3) {
    console.warn("[v0] TMDB key missing; skip enrichment")
    return null
  }

  // Prefer v4 Bearer; fallback to v3 api_key
  const baseUrl = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(query)}&language=${encodeURIComponent(language)}&include_adult=false`
  const url = v3 ? `${baseUrl}&api_key=${encodeURIComponent(v3)}` : baseUrl
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
        const retryUrl = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(query)}&language=${encodeURIComponent(language)}&include_adult=false&api_key=${encodeURIComponent(v3)}`
        const res2 = await fetch(retryUrl, { headers: { Accept: "application/json" }, cache: "no-store" } as any)
        if (!res2.ok) {
          const text2 = await res2.text().catch(() => "")
          console.warn("[v0] TMDB retry(v3) failed", res2.status, res2.statusText, text2 ? `body: ${text2.slice(0, 200)}` : "")
          return null
        }
        const data2 = await res2.json()
        const result2 = (data2?.results || [])[0]
        if (!result2) return null
        return result2
      }
      return null
    }
    const data = await res.json()
    const result = (data?.results || [])[0]
    if (!result) return null
    return result
  } catch (e) {
    console.warn("[v0] TMDB fetch error", e)
    return null
  }
}

async function searchTMDB(title: string) {
  const attempts: Array<{ q: string; lang: string }> = []
  const norm = normalizeQuery(title)
  if (norm) attempts.push({ q: norm, lang: "ko-KR" })
  attempts.push({ q: title, lang: "ko-KR" })
  attempts.push({ q: norm || title, lang: "en-US" })

  for (const a of attempts) {
    try {
      const result = await doSearchOnce(a.q, a.lang)
      if (result) return result
    } catch {}
  }
  return null
}

export async function enrichNetflixItems(items: NetflixItem[], limit = 40): Promise<NetflixItem[]> {
  const enriched: NetflixItem[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (i < limit) {
      try {
        const result = await searchTMDB(item.title)
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
        const result = await searchTMDB(row.title)
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
    out.push({ ...row, poster: getLocalPoster(row.title) })
  }
  return out
}
