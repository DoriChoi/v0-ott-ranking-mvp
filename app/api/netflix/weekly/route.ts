import { type NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import type { WeeklyRow, WeeklyAPIResponse } from "@/lib/types"
import { calculateUnifiedTop100, convertToNetflixItems, getLatestWeek } from "@/lib/ranking"

function parseWeeklyRow(row: any): WeeklyRow | null {
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
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedWeek = searchParams.get("week")

    const excelResponse = await fetch(new URL("/netflix_global.xlsx", request.url).href)
    if (!excelResponse.ok) {
      throw new Error("Failed to fetch Excel file")
    }
    const arrayBuffer = await excelResponse.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })

    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rawData = XLSX.utils.sheet_to_json(worksheet)

    const parsedRows = rawData.map(parseWeeklyRow).filter((row): row is WeeklyRow => row !== null)

    if (parsedRows.length === 0) {
      return NextResponse.json({ error: "No valid data found" }, { status: 404 })
    }

    const latestWeekInfo = getLatestWeek(parsedRows)
    if (!latestWeekInfo) {
      return NextResponse.json({ error: "Could not determine latest week" }, { status: 500 })
    }

    const targetWeek = requestedWeek || latestWeekInfo.weekStart
    const filteredRows = parsedRows.filter((row) => row.weekStart === targetWeek)

    if (filteredRows.length === 0) {
      return NextResponse.json({ error: "No data for requested week" }, { status: 404 })
    }

    const tvEnglish = filteredRows.filter((r) => r.category === "TV" && r.languageType === "English")
    const tvNonEnglish = filteredRows.filter((r) => r.category === "TV" && r.languageType === "Non-English")
    const filmsEnglish = filteredRows.filter((r) => r.category === "Films" && r.languageType === "English")
    const filmsNonEnglish = filteredRows.filter((r) => r.category === "Films" && r.languageType === "Non-English")

    const globalByQuadrant = { tvEnglish, tvNonEnglish, filmsEnglish, filmsNonEnglish }
    const unifiedTop100 = calculateUnifiedTop100(globalByQuadrant)

    const categoryItems = {
      tvEnglish: convertToNetflixItems(tvEnglish, 10),
      tvNonEnglish: convertToNetflixItems(tvNonEnglish, 10),
      filmsEnglish: convertToNetflixItems(filmsEnglish, 10),
      filmsNonEnglish: convertToNetflixItems(filmsNonEnglish, 10),
    }

    const weekInfo = filteredRows[0]
    const apiResponse: WeeklyAPIResponse = {
      globalByQuadrant,
      unifiedTop100,
      weekStart: weekInfo.weekStart,
      weekEnd: weekInfo.weekEnd,
      categoryItems,
    }

    return NextResponse.json(apiResponse)
  } catch (error) {
    console.error("[v0] Error in weekly API:", error)
    return NextResponse.json({ error: "Failed to load weekly data" }, { status: 500 })
  }
}
