import { NextResponse } from "next/server"
import type { CountryAPIResponse, WeeklyRow } from "@/lib/types"
import { CACHE_TIMES, SUPPORTED_COUNTRIES, NETFLIX_URLS } from "@/lib/constants"
import { fetchAndParseExcel, parseCountryData, tryLoadJsonRows, parseCountryFromRows } from "@/lib/parse-excel"
import { convertToNetflixItemsFromCountry } from "@/lib/ranking"
import { enrichNetflixItems } from "@/lib/enrich"

export const revalidate = CACHE_TIMES.WEEKLY // 24 hours

/**
 * GET /api/netflix/country/[code]
 * Returns country-specific Top10
 */
export async function GET(request: Request, { params }: { params: { code: string } }) {
  try {
    const countryCode = params.code.toUpperCase()

    console.log(`[v0] Fetching Netflix data for country: ${countryCode}`)

    // Validate country code
    if (!SUPPORTED_COUNTRIES.includes(countryCode as any)) {
      return NextResponse.json(
        {
          error: "Unsupported country",
          message: `Country code ${countryCode} is not supported. Supported: ${SUPPORTED_COUNTRIES.join(", ")}`,
        },
        { status: 400 },
      )
    }

    // Load from JSON first (public/netflix_country.json); fallback to XLSX
    const jsonRows = tryLoadJsonRows(NETFLIX_URLS.COUNTRY)
    let allCountryRows: WeeklyRow[]
    if (jsonRows && jsonRows.length > 0) {
      allCountryRows = parseCountryFromRows(jsonRows, countryCode)
    } else {
      const workbook = await fetchAndParseExcel(NETFLIX_URLS.COUNTRY)
      allCountryRows = parseCountryData(workbook, countryCode)
    }

    // Determine requested date (latest if not provided)
    const url = new URL(request.url)
    const weekParam = url.searchParams.get("week") || undefined
    // Build available set from both weekStart and weekEnd to be robust for daily sources
    const candidateDates = new Set<string>()
    for (const r of allCountryRows) {
      if (r.weekStart) candidateDates.add(r.weekStart)
      if (r.weekEnd) candidateDates.add(r.weekEnd)
    }
    const available = Array.from(candidateDates).sort()
    const latestDate = available[available.length - 1]
    const weekStart = weekParam && candidateDates.has(weekParam) ? weekParam : latestDate
    const weekEnd = (() => {
      if (!weekStart) return ""
      const d = new Date(weekStart)
      const e = new Date(d)
      e.setDate(e.getDate() + 6)
      return e.toISOString().slice(0, 10)
    })()

    // Slice to selected day and enrich Top10 (match start/end/within range)
    let rowsForWeek: WeeklyRow[] = weekStart
      ? allCountryRows.filter(
          (r) =>
            r.weekStart === weekStart ||
            r.weekEnd === weekStart ||
            (r.weekStart && r.weekEnd && r.weekStart <= weekStart && weekStart <= r.weekEnd),
        )
      : []
    // Fallback: if nothing matched the requested day, use latest available date
    if ((!rowsForWeek || rowsForWeek.length === 0) && available.length > 0) {
      const fallbackDate = available[available.length - 1]
      rowsForWeek = allCountryRows.filter(
        (r) =>
          r.weekStart === fallbackDate ||
          r.weekEnd === fallbackDate ||
          (r.weekStart && r.weekEnd && r.weekStart <= fallbackDate && fallbackDate <= r.weekEnd),
      )
    }
    const items = await enrichNetflixItems(convertToNetflixItemsFromCountry(rowsForWeek, 10), 20)

    const response: CountryAPIResponse = {
      countryCode,
      items,
      weekStart: weekStart || "",
      weekEnd: weekEnd || "",
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error(`[v0] Error fetching country data:`, error)
    return NextResponse.json(
      {
        error: "Failed to fetch country data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
