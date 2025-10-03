import { NextResponse } from "next/server"
import type { CountryAPIResponse, WeeklyRow } from "@/lib/types"
import { CACHE_TIMES, SUPPORTED_COUNTRIES, NETFLIX_URLS } from "@/lib/constants"
import { fetchAndParseExcel, parseCountryData } from "@/lib/parse-excel"
import { convertToNetflixItems } from "@/lib/ranking"
import { enrichNetflixItems } from "@/lib/enrich"

export const revalidate = CACHE_TIMES.WEEKLY // 24 hours
export const dynamic = "force-dynamic"

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

    // Fetch and parse country workbook from public
    const workbook = await fetchAndParseExcel(NETFLIX_URLS.COUNTRY)
    const allCountryRows = parseCountryData(workbook, countryCode)

    // Filter to 2025 only
    const only2025 = allCountryRows.filter((r) => r.weekStart.startsWith("2025-"))

    // Determine requested week
    const url = new URL(request.url)
    const weekParam = url.searchParams.get("week") || undefined
    const weeksSet = new Set<string>(only2025.map((r) => r.weekStart))
    const availableWeeks = Array.from(weeksSet).sort()
    const latestWeekStart = availableWeeks[availableWeeks.length - 1]
    const weekStart = weekParam && weeksSet.has(weekParam) ? weekParam : latestWeekStart
    const weekEnd = (() => {
      if (!weekStart) return ""
      const d = new Date(weekStart)
      const e = new Date(d)
      e.setDate(e.getDate() + 6)
      return e.toISOString().slice(0, 10)
    })()

    // Slice to selected week and enrich Top10
    const rowsForWeek: WeeklyRow[] = weekStart
      ? only2025.filter((r) => r.weekStart === weekStart)
      : []
    const items = await enrichNetflixItems(convertToNetflixItems(rowsForWeek, 10), 20)

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
