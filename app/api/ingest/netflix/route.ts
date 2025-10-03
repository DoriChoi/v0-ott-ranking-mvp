import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { cacheSet } from '@/lib/redis'
import { enrichWithTMDB } from '@/lib/tmdb'
import { loadLocalSpreadsheetRows } from '@/lib/fileLoaders'
import { parse as parseCsv } from 'csv-parse/sync'

const TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    let week = searchParams.get('week') || ''
    const region = (searchParams.get('region') || 'KR').toUpperCase()
    const useLocal = (searchParams.get('local') || '0') === '1'
    const localFile = searchParams.get('file') || ''

    let rows: any[] = []
    if (useLocal || localFile) {
      const rel = localFile || '/netflix.xlsx'
      try {
        if (rel.startsWith('/')) {
          // Fetch from public/ via same-origin URL
          const base = new URL(req.url)
          const url = new URL(rel, `${base.origin}`)
          const res = await fetch(url.toString(), { cache: 'no-store' })
          if (!res.ok) return json({ error: 'failed_to_fetch_public_file', status: res.status, file: rel }, 502)
          const buf = Buffer.from(await res.arrayBuffer())
          if (/\.csv$/i.test(rel)) {
            rows = parseCsv(buf, { columns: true, skip_empty_lines: true, trim: true }) as any[]
          } else {
            const wb = XLSX.read(buf, { type: 'buffer' as any })
            const sheetName = wb.SheetNames[0]
            const ws = wb.Sheets[sheetName]
            rows = XLSX.utils.sheet_to_json(ws, { defval: null })
          }
        } else {
          // Filesystem relative path fallback (rare)
          rows = loadLocalSpreadsheetRows(rel)
        }
      } catch (e: any) {
        return json({ error: 'failed_to_read_local', detail: e?.message, file: rel }, 500)
      }
    } else {
      const xlsxUrl = 'https://top10.netflix.com/data/all-weeks-country.xlsx'
      const res = await fetch(xlsxUrl, { next: { revalidate: 0 } })
      if (!res.ok) {
        return json({ error: `Failed to fetch Netflix XLSX: ${res.status}` }, 502)
      }
      const arrayBuf = await res.arrayBuffer()
      const wb = XLSX.read(arrayBuf, { type: 'array' })
      const sheetName = wb.SheetNames.find((n: string) => /country/i.test(n)) || wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      rows = XLSX.utils.sheet_to_json(ws, { defval: null })
    }

    const norm = rows.map((r) => {
      const o: Record<string, any> = {}
      for (const k of Object.keys(r)) o[k.toLowerCase()] = r[k]
      return o
    })

    const countryKey = ['country', 'country_iso2', 'country_iso', 'country_code'].find((k) => k in (norm[0] || {})) || 'country'
    const weekKey = ['week', 'week_ending', 'weekending', 'week_ending_date'].find((k) => k in (norm[0] || {})) || 'week'
    const titleKey = ['title', 'show_title', 'film_title', 'season_title'].find((k) => k in (norm[0] || {})) || 'title'
    const rankKey = ['weekly_rank', 'rank'].find((k) => k in (norm[0] || {})) || 'weekly_rank'
    const viewsKey = ['weekly_hours_viewed', 'hours_viewed', 'views'].find((k) => k in (norm[0] || {}))

    // If week is missing or set to 'latest', auto-detect the most recent week from data (for the given region if present)
    if (!week || week.toLowerCase() === 'latest') {
      const weeks = new Set<string>()
      for (const r of norm) {
        const c = (r[countryKey] || '').toString().toUpperCase()
        if (c && (c === region || c === 'KOR' || c === 'KR')) {
          const w = (r[weekKey] || '').toString().slice(0, 10)
          if (w) weeks.add(w)
        }
      }
      if (weeks.size === 0) {
        return json({ error: 'no_weeks_found_in_data_for_region', region }, 400)
      }
      week = Array.from(weeks).sort().pop() as string
    }

    let filtered = norm.filter((r) => {
      const w = (r[weekKey] || '').toString().slice(0, 10)
      const c = (r[countryKey] || '').toString().toUpperCase()
      return w === week && (c === region || c === 'KOR' || c === 'KR')
    })
    // If nothing found for the region, relax: use latest week across all countries
    if (filtered.length === 0) {
      const weeksAll = new Set<string>()
      for (const r of norm) {
        const w = (r[weekKey] || '').toString().slice(0, 10)
        if (w) weeksAll.add(w)
      }
      if (weeksAll.size > 0) {
        const latestAll = Array.from(weeksAll).sort().pop() as string
        week = latestAll
        filtered = norm.filter((r) => ((r[weekKey] || '').toString().slice(0, 10)) === latestAll)
      }
    }

    const byTitle = new Map<string, { title: string; rank: number; week: string; weeklyViews?: number | null; poster?: string | null; year?: number | null; overview?: string | null }>()
    for (const r of filtered) {
      const title = (r[titleKey] || '').toString()
      const rank = Number(r[rankKey]) || 999
      const w = (r[weekKey] || '').toString().slice(0, 10)
      const v = viewsKey ? Number(r[viewsKey]) || null : null
      const prev = byTitle.get(title)
      if (!prev || rank < prev.rank) {
        byTitle.set(title, { title, rank, week: w, weeklyViews: v })
      }
    }

    if (process.env.ENRICH_TMDB === '1') {
      for (const entry of byTitle.values()) {
        try {
          const meta = await enrichWithTMDB(entry.title)
          if (meta) {
            entry.poster = meta.poster ?? null
            entry.year = meta.year ?? null
            entry.overview = meta.overview ?? null
          }
        } catch {}
      }
    }

    const items = Array.from(byTitle.values())
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 10)
      .map((it) => ({
        platform: 'netflix' as const,
        title: it.title,
        rank: it.rank,
        week: it.week,
        weeklyViews: it.weeklyViews ?? null,
        poster: (it as any).poster ?? null,
        year: (it as any).year ?? null,
        overview: (it as any).overview ?? null,
      }))

    const key = `raw:${week}:netflix`
    await cacheSet(key, items, TTL_SECONDS)

    return json({ ok: true, count: items.length, week, region, key })
  } catch (e: any) {
    console.error('ingest netflix error', e)
    return json({ error: 'internal_error', detail: e?.message }, 500)
  }
}

export async function OPTIONS() {
  return json({ ok: true })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
