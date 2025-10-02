import { NextResponse } from "next/server"
import type { WeeklyAPIResponse } from "@/lib/types"
import { CACHE_TIMES } from "@/lib/constants"
// import { NETFLIX_URLS } from "@/lib/constants"
// import { fetchAndParseExcel, parseWeeklyGlobal } from "@/lib/parse-excel"
import { calculateUnifiedTop100 } from "@/lib/ranking"
import { sampleWeeklyRows } from "@/lib/sample-data"

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
    const unifiedTop100 = calculateUnifiedTop100(globalByQuadrant)

    // Get latest week info from sample data
    const latestWeek = sampleWeeklyRows[0]

    const response: WeeklyAPIResponse = {
      globalByQuadrant,
      unifiedTop100,
      weekStart: latestWeek?.weekStart || "2025-01-27",
      weekEnd: latestWeek?.weekEnd || "2025-02-02",
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
