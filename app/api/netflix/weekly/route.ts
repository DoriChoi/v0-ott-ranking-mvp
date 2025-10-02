import { NextResponse } from "next/server"
import type { WeeklyAPIResponse } from "@/lib/types"
import { CACHE_TIMES } from "@/lib/constants"
// import { NETFLIX_URLS } from "@/lib/constants"
// import { fetchAndParseExcel, parseWeeklyGlobal } from "@/lib/parse-excel"
import { calculateUnifiedTop100, convertToNetflixItems } from "@/lib/ranking"
import { sampleWeeklyRows } from "@/lib/sample-data"
import { enrichNetflixItems } from "@/lib/enrich"

export const revalidate = CACHE_TIMES.WEEKLY // 24 hours

/**
 * GET /api/netflix/weekly
 * Returns global weekly data by quadrant + unified Top100
 */
export async function GET(request: Request) {
  try {
    // TODO: 프로덕션에서는 아래 주석 해제하여 실제 엑셀 파싱 사용
    // const workbook = await fetchAndParseExcel(NETFLIX_URLS.WEEKLY_GLOBAL)
    // const globalByQuadrant = parseWeeklyGlobal(workbook)

    // 샘플 데이터를 카테고리별로 분류
    const globalByQuadrant = {
      tvEnglish: sampleWeeklyRows.filter((row) => row.category === "TV" && row.languageType === "English"),
      tvNonEnglish: sampleWeeklyRows.filter((row) => row.category === "TV" && row.languageType === "Non-English"),
      filmsEnglish: sampleWeeklyRows.filter((row) => row.category === "Films" && row.languageType === "English"),
      filmsNonEnglish: sampleWeeklyRows.filter((row) => row.category === "Films" && row.languageType === "Non-English"),
    }

    // Calculate unified Top100
    const unifiedTop100Raw = calculateUnifiedTop100(globalByQuadrant)
    const unifiedTop100 = await enrichNetflixItems(unifiedTop100Raw, 60)

    // Prepare category items (server-side) so client can directly render enriched data
    const categoryItems = {
      tvEnglish: await enrichNetflixItems(convertToNetflixItems(globalByQuadrant.tvEnglish, 10), 20),
      tvNonEnglish: await enrichNetflixItems(convertToNetflixItems(globalByQuadrant.tvNonEnglish, 10), 20),
      filmsEnglish: await enrichNetflixItems(convertToNetflixItems(globalByQuadrant.filmsEnglish, 10), 20),
      filmsNonEnglish: await enrichNetflixItems(convertToNetflixItems(globalByQuadrant.filmsNonEnglish, 10), 20),
    }

    // Get latest week info from sample data
    const latestWeek = sampleWeeklyRows[0]

    // Optional week param
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
    let weekStart = latestWeek?.weekStart || "2025-01-27"
    let weekEnd = latestWeek?.weekEnd || "2025-02-02"
    if (weekParam) {
      const start = new Date(weekParam)
      if (!isNaN(start.getTime())) {
        weekStart = formatDate(start)
        weekEnd = formatDate(addDays(start, 6))
      }
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
