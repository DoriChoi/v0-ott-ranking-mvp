import { NextResponse } from "next/server"
import type { CountryAPIResponse } from "@/lib/types"
import { CACHE_TIMES, SUPPORTED_COUNTRIES } from "@/lib/constants"
// import { NETFLIX_URLS } from "@/lib/constants"
// import { fetchAndParseExcel, parseCountryData } from "@/lib/parse-excel"
import { convertToNetflixItems } from "@/lib/ranking"
import { sampleWeeklyRows } from "@/lib/sample-data"

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

    // TODO: 프로덕션에서는 아래 주석 해제하여 실제 엑셀 파싱 사용
    // const workbook = await fetchAndParseExcel(NETFLIX_URLS.WEEKLY_GLOBAL)
    // const countryData = parseCountryData(workbook, countryCode)

    // 샘플 데이터에서 국가별 데이터 시뮬레이션 (상위 20개 항목 사용)
    const countryData = sampleWeeklyRows.slice(0, 20).map((row) => ({
      ...row,
      countryCode,
    }))

    console.log(`[v0] Parsed country data for ${countryCode}:`, countryData.length)

    // Convert to NetflixItem format (Top10)
    const items = convertToNetflixItems(countryData, 10)

    // Get latest week info from sample data
    const latestWeek = sampleWeeklyRows[0]

    const response: CountryAPIResponse = {
      countryCode,
      items,
      weekStart: latestWeek?.weekStart || "2025-01-27",
      weekEnd: latestWeek?.weekEnd || "2025-02-02",
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
