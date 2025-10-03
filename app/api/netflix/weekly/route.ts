import { NextResponse } from "next/server"
import type { WeeklyAPIResponse, WeeklyRow } from "@/lib/types"
import { CACHE_TIMES, NETFLIX_URLS } from "@/lib/constants"
import { fetchAndParseExcel, parseWeeklyGlobal, tryLoadJsonRows, parseWeeklyGlobalFromRows } from "@/lib/parse-excel"
import { calculateUnifiedTop100, convertToNetflixItems } from "@/lib/ranking"
import { enrichNetflixItems } from "@/lib/enrich"

export const revalidate = CACHE_TIMES.WEEKLY // 24 hours
export const runtime = "nodejs"

/**
 * GET /api/netflix/weekly
 * Returns global weekly data by quadrant + unified Top100
 */
export async function GET(request: Request) {
  try {
    // 1) Load from JSON first (public/netflix_global.json); fallback to XLSX
    const jsonRows = tryLoadJsonRows(NETFLIX_URLS.WEEKLY_GLOBAL)
    let parsed: { tvEnglish: WeeklyRow[]; tvNonEnglish: WeeklyRow[]; filmsEnglish: WeeklyRow[]; filmsNonEnglish: WeeklyRow[] }
    if (jsonRows && jsonRows.length > 0) {
      parsed = parseWeeklyGlobalFromRows(jsonRows)
    } else {
      const workbook = await fetchAndParseExcel(NETFLIX_URLS.WEEKLY_GLOBAL)
      parsed = parseWeeklyGlobal(workbook)
    }
    // 2) Base data for menus: prefer 2025 if exists; else fallback to all
    const only2025 = {
      tvEnglish: parsed.tvEnglish.filter((r) => r.weekStart.startsWith("2025-")),
      tvNonEnglish: parsed.tvNonEnglish.filter((r) => r.weekStart.startsWith("2025-")),
      filmsEnglish: parsed.filmsEnglish.filter((r) => r.weekStart.startsWith("2025-")),
      filmsNonEnglish: parsed.filmsNonEnglish.filter((r) => r.weekStart.startsWith("2025-")),
    }
    const any2025 =
      only2025.tvEnglish.length +
      only2025.tvNonEnglish.length +
      only2025.filmsEnglish.length +
      only2025.filmsNonEnglish.length > 0
    const baseForMenus = any2025 ? only2025 : parsed
    if (!any2025) {
      console.warn("[v0] No 2025 weekly data; falling back to latest available year for menus.")
    }

    // Parse optional week param and define helpers
    const url = new URL(request.url)
    const weekParam = url.searchParams.get("week") || undefined
    function formatDate(d: Date) {
      return d.toISOString().slice(0, 10)
    }
    function addDays(d: Date, days: number) {
      const nd = new Date(d)
      nd.setDate(nd.getDate() + days)
      return nd
    }
    // Compute latest Monday (UTC) to match WeekSelector default options
    function getMondayUTC(d: Date) {
      const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      const day = nd.getUTCDay()
      const diff = (day === 0 ? -6 : 1) - day // move to Monday
      nd.setUTCDate(nd.getUTCDate() + diff)
      return nd
    }
    const today = new Date()
    const latestMonday = getMondayUTC(today)
    // 3) Determine effective week within available 2025 weeks
    const collectWeeks = (rows: WeeklyRow[]) => Array.from(new Set(rows.map((r) => r.weekStart)))
    const weeksSet = new Set<string>([
      ...collectWeeks(baseForMenus.tvEnglish),
      ...collectWeeks(baseForMenus.tvNonEnglish),
      ...collectWeeks(baseForMenus.filmsEnglish),
      ...collectWeeks(baseForMenus.filmsNonEnglish),
    ])
    const availableWeeks = Array.from(weeksSet).sort() // ascending
    if (availableWeeks.length === 0) {
      console.warn("[v0] No weekly data available from Excel (all years).")
      return NextResponse.json({
        globalByQuadrant: { tvEnglish: [], tvNonEnglish: [], filmsEnglish: [], filmsNonEnglish: [] },
        unifiedTop100: [],
        weekStart: "",
        weekEnd: "",
        categoryItems: { tvEnglish: [], tvNonEnglish: [], filmsEnglish: [], filmsNonEnglish: [] },
      } satisfies WeeklyAPIResponse)
    }

    function pickLatestAvailableWeek(): string | undefined {
      return availableWeeks[availableWeeks.length - 1]
    }

    let weekStart = formatDate(latestMonday)
    // Prefer requested week if it exists in 2025 data
    if (weekParam && weeksSet.has(weekParam)) {
      weekStart = weekParam
    } else {
      // Fallback to latest available 2025 week if current Monday isn't available
      const latest = pickLatestAvailableWeek()
      if (latest) weekStart = latest
    }
    let weekEnd = formatDate(addDays(new Date(weekStart), 6))

    // 4) Slice data to the selected week
    const globalByQuadrant = {
      tvEnglish: baseForMenus.tvEnglish.filter((r) => r.weekStart === weekStart),
      tvNonEnglish: baseForMenus.tvNonEnglish.filter((r) => r.weekStart === weekStart),
      filmsEnglish: baseForMenus.filmsEnglish.filter((r) => r.weekStart === weekStart),
      filmsNonEnglish: baseForMenus.filmsNonEnglish.filter((r) => r.weekStart === weekStart),
    }

    // Ensure selected week has any data
    const totalCount =
      globalByQuadrant.tvEnglish.length +
      globalByQuadrant.tvNonEnglish.length +
      globalByQuadrant.filmsEnglish.length +
      globalByQuadrant.filmsNonEnglish.length
    if (totalCount === 0) {
      console.warn("[v0] Selected week has no rows:", weekStart)
      return NextResponse.json({
        globalByQuadrant,
        unifiedTop100: [],
        weekStart,
        weekEnd,
        categoryItems: { tvEnglish: [], tvNonEnglish: [], filmsEnglish: [], filmsNonEnglish: [] },
      } satisfies WeeklyAPIResponse)
    }

    // 5) Build responses
    // Unified Top100 from last ~30 days (1 month) using the full parsed dataset (not single week)
    const allRows: WeeklyRow[] = [
      ...parsed.tvEnglish,
      ...parsed.tvNonEnglish,
      ...parsed.filmsEnglish,
      ...parsed.filmsNonEnglish,
    ]
    let latestOverall = ""
    for (const r of allRows) {
      if (r.weekStart > latestOverall) latestOverall = r.weekStart
    }
    const latestDate = latestOverall ? new Date(latestOverall + "T00:00:00Z") : null
    const cutoff = latestDate ? new Date(latestDate) : null
    if (cutoff) cutoff.setUTCDate(cutoff.getUTCDate() - 30)
    const last90ByQuadrant = {
      tvEnglish: parsed.tvEnglish.filter((r) => (cutoff ? r.weekStart >= cutoff.toISOString().slice(0, 10) : true)),
      tvNonEnglish: parsed.tvNonEnglish.filter((r) => (cutoff ? r.weekStart >= cutoff.toISOString().slice(0, 10) : true)),
      filmsEnglish: parsed.filmsEnglish.filter((r) => (cutoff ? r.weekStart >= cutoff.toISOString().slice(0, 10) : true)),
      filmsNonEnglish: parsed.filmsNonEnglish.filter((r) => (cutoff ? r.weekStart >= cutoff.toISOString().slice(0, 10) : true)),
    }
    const unifiedTop100Raw = calculateUnifiedTop100(last90ByQuadrant)
    const unifiedTop100 = await enrichNetflixItems(unifiedTop100Raw, 40)
    const categoryItems = {
      tvEnglish: await enrichNetflixItems(convertToNetflixItems(globalByQuadrant.tvEnglish, 10), 20),
      tvNonEnglish: await enrichNetflixItems(convertToNetflixItems(globalByQuadrant.tvNonEnglish, 10), 20),
      filmsEnglish: await enrichNetflixItems(convertToNetflixItems(globalByQuadrant.filmsEnglish, 10), 20),
      filmsNonEnglish: await enrichNetflixItems(convertToNetflixItems(globalByQuadrant.filmsNonEnglish, 10), 20),
    }

    const response: WeeklyAPIResponse = {
      globalByQuadrant,
      unifiedTop100,
      weekStart,
      weekEnd,
      categoryItems,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error fetching weekly data:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch weekly data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
