import { type NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import type { WeeklyRow, CountryAPIResponse } from "@/lib/types"
import { convertToNetflixItemsFromCountry, getLatestWeek } from "@/lib/ranking"

function parseCountryRow(row: any): WeeklyRow | null {
  try {
    const weekStr = String(row.week || "").trim()
    if (!weekStr) return null

    const [weekStart, weekEnd] = weekStr.includes(" to ")
      ? weekStr.split(" to ").map((s) => s.trim())
      : [weekStr, weekStr]

    const category = String(row.category || "").includes("Films") ? "Films" : "TV"
    const languageType = String(row.category || "").includes("English") ? "English" : "Non-English"

    const showTitle = String(row.show_title || "").trim()
    const seasonTitle = String(row.season_title || "").trim()
    const title = seasonTitle || showTitle

    if (!title) return null

    return {
      weekStart,
      weekEnd,
      title,
      category,
      languageType,
      hoursViewed: Number(row.weekly_hours_viewed) || 0,
      views: Number(row.weekly_views) || 0,
      weeksInTop10: Number(row.cumulative_weeks_in_top_10) || 0,
      countryCode: String(row.country_iso2 || "").trim(),
      weeklyRank: Number(row.weekly_rank) || undefined,
    }
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ countryCode: string }> | { countryCode: string } },
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { countryCode } = resolvedParams
    const { searchParams } = new URL(request.url)
    const requestedWeek = searchParams.get("week")

    const filePath = `${process.cwd()}/public/netflix_country.xlsx`
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rawData = XLSX.utils.sheet_to_json(worksheet)

    const parsedRows = rawData.map(parseCountryRow).filter((row): row is WeeklyRow => row !== null)

    const countryRows = parsedRows.filter((row) => row.countryCode === countryCode)

    if (countryRows.length === 0) {
      return NextResponse.json({ error: "No data for this country" }, { status: 404 })
    }

    const latestWeekInfo = getLatestWeek(countryRows)
    if (!latestWeekInfo) {
      return NextResponse.json({ error: "Could not determine latest week" }, { status: 500 })
    }

    const targetWeek = requestedWeek || latestWeekInfo.weekStart
    const filteredRows = countryRows.filter((row) => row.weekStart === targetWeek)

    if (filteredRows.length === 0) {
      return NextResponse.json({ error: "No data for requested week" }, { status: 404 })
    }

    const items = convertToNetflixItemsFromCountry(filteredRows, 10)
    const weekInfo = filteredRows[0]

    const response: CountryAPIResponse = {
      countryCode,
      items,
      weekStart: weekInfo.weekStart,
      weekEnd: weekInfo.weekEnd,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[v0] Error in country API:", error)
    return NextResponse.json({ error: "Failed to load country data" }, { status: 500 })
  }
}
