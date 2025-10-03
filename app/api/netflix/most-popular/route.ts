import { NextResponse } from "next/server"
import type { MostPopularAPIResponse } from "@/lib/types"
import { CACHE_TIMES, NETFLIX_URLS } from "@/lib/constants"
import { fetchAndParseExcel, parseMostPopular, tryLoadJsonRows, parseMostPopularFromRows } from "@/lib/parse-excel"
import { enrichPopularRows } from "@/lib/enrich"

export const revalidate = CACHE_TIMES.MOST_POPULAR // 7 days
export const runtime = "nodejs"

/**
 * GET /api/netflix/most-popular
 * Returns 91-day most popular data by quadrant
 */
export async function GET(request: Request) {
  try {
    console.log("[v0] Fetching Netflix most popular data...")
    // Load from JSON first (public/netflix_mostpopular.json); fallback to XLSX
    const jsonRows = tryLoadJsonRows(NETFLIX_URLS.MOST_POPULAR)
    let parsed
    if (jsonRows && jsonRows.length > 0) {
      parsed = parseMostPopularFromRows(jsonRows)
    } else {
      const workbook = await fetchAndParseExcel(NETFLIX_URLS.MOST_POPULAR)
      parsed = parseMostPopular(workbook)
    }

    // Enrich posters/localized titles
    const popularData = {
      tvEnglish: await enrichPopularRows(parsed.tvEnglish, 40),
      tvNonEnglish: await enrichPopularRows(parsed.tvNonEnglish, 40),
      filmsEnglish: await enrichPopularRows(parsed.filmsEnglish, 40),
      filmsNonEnglish: await enrichPopularRows(parsed.filmsNonEnglish, 40),
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
