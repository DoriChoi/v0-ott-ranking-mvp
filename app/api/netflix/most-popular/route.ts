import { NextResponse } from "next/server"
import type { MostPopularAPIResponse, PopularRow } from "@/lib/types"
import { CACHE_TIMES } from "@/lib/constants"
// import { NETFLIX_URLS } from "@/lib/constants"
// import { fetchAndParseExcel, parseMostPopular } from "@/lib/parse-excel"
import { sampleWeeklyRows } from "@/lib/sample-data"

export const revalidate = CACHE_TIMES.MOST_POPULAR // 7 days

/**
 * GET /api/netflix/most-popular
 * Returns 91-day most popular data by quadrant
 */
export async function GET(request: Request) {
  try {
    console.log("[v0] Fetching Netflix most popular data...")

    // TODO: 프로덕션에서는 아래 주석 해제하여 실제 엑셀 파싱 사용
    // const workbook = await fetchAndParseExcel(NETFLIX_URLS.MOST_POPULAR)
    // const popularData = parseMostPopular(workbook)

    // 샘플 데이터를 91일 누적 데이터로 변환
    const popularData = {
      tvEnglish: sampleWeeklyRows
        .filter((row) => row.category === "TV" && row.languageType === "English")
        .slice(0, 10)
        .map(
          (row) =>
            ({
              title: row.title,
              category: row.category,
              languageType: row.languageType,
              hours91d: row.hoursViewed * 13, // 13주 시뮬레이션
              views91d: row.views * 13,
            }) as PopularRow,
        ),
      tvNonEnglish: sampleWeeklyRows
        .filter((row) => row.category === "TV" && row.languageType === "Non-English")
        .slice(0, 10)
        .map(
          (row) =>
            ({
              title: row.title,
              category: row.category,
              languageType: row.languageType,
              hours91d: row.hoursViewed * 13,
              views91d: row.views * 13,
            }) as PopularRow,
        ),
      filmsEnglish: sampleWeeklyRows
        .filter((row) => row.category === "Films" && row.languageType === "English")
        .slice(0, 10)
        .map(
          (row) =>
            ({
              title: row.title,
              category: row.category,
              languageType: row.languageType,
              hours91d: row.hoursViewed * 13,
              views91d: row.views * 13,
            }) as PopularRow,
        ),
      filmsNonEnglish: sampleWeeklyRows
        .filter((row) => row.category === "Films" && row.languageType === "Non-English")
        .slice(0, 10)
        .map(
          (row) =>
            ({
              title: row.title,
              category: row.category,
              languageType: row.languageType,
              hours91d: row.hoursViewed * 13,
              views91d: row.views * 13,
            }) as PopularRow,
        ),
    }

    console.log("[v0] Parsed most popular data:", {
      tvEnglish: popularData.tvEnglish.length,
      tvNonEnglish: popularData.tvNonEnglish.length,
      filmsEnglish: popularData.filmsEnglish.length,
      filmsNonEnglish: popularData.filmsNonEnglish.length,
    })

    const response: MostPopularAPIResponse = popularData

    return NextResponse.json(response)
  } catch (error) {
    console.error("[v0] Error fetching most popular data:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch most popular data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
