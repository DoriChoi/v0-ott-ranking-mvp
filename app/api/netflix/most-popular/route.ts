import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import type { PopularRow, MostPopularAPIResponse } from "@/lib/types"

function parsePopularRow(row: any): PopularRow | null {
  try {
    const category = String(row.category || "").includes("Films") ? "Films" : "TV"
    const languageType = String(row.category || "").includes("English") ? "English" : "Non-English"

    const showTitle = String(row.show_title || "").trim()
    const seasonTitle = String(row.season_title || "").trim()
    const title = seasonTitle || showTitle

    if (!title) return null

    return {
      title,
      category,
      languageType,
      views91d: Number(row.views_91d) || 0,
      hours91d: Number(row.hours_viewed_91d) || 0,
      rank: Number(row.rank) || undefined,
    }
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const filePath = `${process.cwd()}/public/netflix_mostpopular.xlsx`
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rawData = XLSX.utils.sheet_to_json(worksheet)

    const parsedRows = rawData.map(parsePopularRow).filter((row): row is PopularRow => row !== null)

    if (parsedRows.length === 0) {
      return NextResponse.json({ error: "No valid data found" }, { status: 404 })
    }

    const tvEnglish = parsedRows.filter((r) => r.category === "TV" && r.languageType === "English")
    const tvNonEnglish = parsedRows.filter((r) => r.category === "TV" && r.languageType === "Non-English")
    const filmsEnglish = parsedRows.filter((r) => r.category === "Films" && r.languageType === "English")
    const filmsNonEnglish = parsedRows.filter((r) => r.category === "Films" && r.languageType === "Non-English")

    const response: MostPopularAPIResponse = {
      tvEnglish,
      tvNonEnglish,
      filmsEnglish,
      filmsNonEnglish,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[v0] Error in most-popular API:", error)
    return NextResponse.json({ error: "Failed to load most popular data" }, { status: 500 })
  }
}
