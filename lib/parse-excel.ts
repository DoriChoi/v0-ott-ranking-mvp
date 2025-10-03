import * as XLSX from "xlsx"
import { z } from "zod"
import type { WeeklyRow, PopularRow, Category, LanguageType, WeeklyRowRaw, PopularRowRaw } from "./types"
import { SHEET_PATTERNS, COLUMN_MAPPINGS } from "./constants"
import { readFileSync } from "fs"
import { join } from "path"

// Zod schemas for validation
const weeklyRowSchema = z.object({
  weekStart: z.string(),
  weekEnd: z.string(),
  title: z.string().min(1),
  category: z.enum(["TV", "Films"]),
  languageType: z.enum(["English", "Non-English"]),
  hoursViewed: z.number().positive(),
  views: z.number().positive(),
  weeksInTop10: z.number().int().positive(),
  countryCode: z.string().optional(),
})

const popularRowSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["TV", "Films"]),
  languageType: z.enum(["English", "Non-English"]),
  views91d: z.number().positive(),
  hours91d: z.number().positive(),
})

/**
 * Fetch and parse Excel file from URL
 */
export async function fetchAndParseExcel(url: string): Promise<XLSX.WorkBook> {
  // If given a same-origin path like '/netflix_global.xlsx', read from public folder via filesystem
  if (url.startsWith("/")) {
    const filePath = join(process.cwd(), "public", url.slice(1))
    const buf = readFileSync(filePath)
    return XLSX.read(buf, { type: "buffer" as any })
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LiveRankMini/1.0)",
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Excel: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: "array" })
  return workbook
}

/**
 * Normalize column names to lowercase and remove spaces
 */
function normalizeColumnName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_")
}

/**
 * Find column value by multiple possible names
 */
function findColumnValue(row: any, possibleNames: readonly string[]): any {
  for (const name of possibleNames) {
    const normalized = normalizeColumnName(name)
    for (const key in row) {
      if (normalizeColumnName(key) === normalized) {
        return row[key]
      }
    }
  }
  return undefined
}

/**
 * Parse week value (string like 'Week of January 6, 2025' or ISO '2025-01-06', or Excel serial number)
 * to ISO date range (YYYY-MM-DD for Monday start + 6 days end).
 */
function parseWeekToDateRange(weekVal: unknown): { weekStart: string; weekEnd: string } {
  try {
    let baseDate: Date | null = null

    if (typeof weekVal === "number" && isFinite(weekVal)) {
      // Excel serial date: days since 1899-12-30
      const excelEpoch = Date.UTC(1899, 11, 30)
      const ms = excelEpoch + Math.floor(weekVal) * 24 * 60 * 60 * 1000
      baseDate = new Date(ms)
    } else if (typeof weekVal === "string") {
      let s = weekVal.trim()
      // Remove common prefixes like 'Week of'
      s = s.replace(/^Week\s+of\s+/i, "")
      // Try parsing directly; JS Date can handle 'January 6, 2025' and ISO
      const d1 = new Date(s)
      if (!isNaN(d1.getTime())) {
        baseDate = d1
      } else {
        // Try removing commas as a fallback
        const d2 = new Date(s.replace(/,/g, ""))
        if (!isNaN(d2.getTime())) baseDate = d2
      }
    }

    if (!baseDate || isNaN(baseDate.getTime())) throw new Error("Invalid date")

    // Normalize to YYYY-MM-DD (keep as-is; upstream weeks are Monday-based already)
    const weekStart = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()))
      .toISOString()
      .split("T")[0]
    const endDate = new Date(weekStart + "T00:00:00Z")
    endDate.setUTCDate(endDate.getUTCDate() + 6)
    const weekEnd = endDate.toISOString().split("T")[0]
    return { weekStart, weekEnd }
  } catch (e) {
    console.warn(`[v0] Failed to parse week: ${String(weekVal)}`)
    return { weekStart: "", weekEnd: "" }
  }
}

/**
 * Determine category and language type from sheet name
 */
function getCategoryAndLanguage(sheetName: string): { category: Category; languageType: LanguageType } | null {
  if (SHEET_PATTERNS.TV_ENGLISH.test(sheetName)) {
    return { category: "TV", languageType: "English" }
  }
  if (SHEET_PATTERNS.TV_NON_ENGLISH.test(sheetName)) {
    return { category: "TV", languageType: "Non-English" }
  }
  if (SHEET_PATTERNS.FILMS_ENGLISH.test(sheetName)) {
    return { category: "Films", languageType: "English" }
  }
  if (SHEET_PATTERNS.FILMS_NON_ENGLISH.test(sheetName)) {
    return { category: "Films", languageType: "Non-English" }
  }
  return null
}

/**
 * Parse weekly global data from workbook
 */
export function parseWeeklyGlobal(workbook: XLSX.WorkBook): {
  tvEnglish: WeeklyRow[]
  tvNonEnglish: WeeklyRow[]
  filmsEnglish: WeeklyRow[]
  filmsNonEnglish: WeeklyRow[]
} {
  const result = {
    tvEnglish: [] as WeeklyRow[],
    tvNonEnglish: [] as WeeklyRow[],
    filmsEnglish: [] as WeeklyRow[],
    filmsNonEnglish: [] as WeeklyRow[],
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rawData: WeeklyRowRaw[] = XLSX.utils.sheet_to_json(sheet)

    // Try to infer from sheet name; otherwise derive from a 'category' column per row
    const nameCategoryLang = getCategoryAndLanguage(sheetName)

    for (const raw of rawData) {
      try {
        const weekStr = findColumnValue(raw, COLUMN_MAPPINGS.WEEK)
        const title = findColumnValue(raw, COLUMN_MAPPINGS.TITLE)
        const hoursViewed = Number(findColumnValue(raw, COLUMN_MAPPINGS.WEEKLY_HOURS))
        const views = Number(findColumnValue(raw, COLUMN_MAPPINGS.WEEKLY_VIEWS))
        const weeksInTop10 = Number(findColumnValue(raw, COLUMN_MAPPINGS.CUMULATIVE_WEEKS))

        if (!weekStr || !title || isNaN(hoursViewed) || isNaN(views) || isNaN(weeksInTop10)) {
          continue
        }

        const { weekStart, weekEnd } = parseWeekToDateRange(weekStr)
        if (!weekStart || !weekEnd) continue

        // Determine category/language: prefer sheet name heuristic, else from row 'category' text
        let categoryLang = nameCategoryLang
        if (!categoryLang) {
          const catStr = String(findColumnValue(raw, COLUMN_MAPPINGS.CATEGORY) || "")
          if (catStr) {
            const catLower = catStr.toLowerCase()
            const isTV = catLower.includes("tv")
            const isNon = catLower.includes("non")
            categoryLang = {
              category: (isTV ? "TV" : "Films") as Category,
              languageType: (isNon ? "Non-English" : "English") as LanguageType,
            }
          }
        }
        if (!categoryLang) continue

        const parsed: WeeklyRow = {
          weekStart,
          weekEnd,
          title: String(title),
          category: categoryLang.category,
          languageType: categoryLang.languageType,
          hoursViewed,
          views,
          weeksInTop10,
        }

        const validated = weeklyRowSchema.parse(parsed)

        // Add to appropriate category
        if (validated.category === "TV" && validated.languageType === "English") {
          result.tvEnglish.push(validated)
        } else if (validated.category === "TV" && validated.languageType === "Non-English") {
          result.tvNonEnglish.push(validated)
        } else if (validated.category === "Films" && validated.languageType === "English") {
          result.filmsEnglish.push(validated)
        } else if (validated.category === "Films" && validated.languageType === "Non-English") {
          result.filmsNonEnglish.push(validated)
        }
      } catch (error) {
        console.warn(`[v0] Failed to parse weekly row:`, error)
      }
    }
  }

  return result
}

/**
 * Parse country-specific data from workbook
 */
export function parseCountryData(workbook: XLSX.WorkBook, countryCode: string): WeeklyRow[] {
  const result: WeeklyRow[] = []

  // Find sheet matching country code
  let sheetName = workbook.SheetNames.find((name) => name.toUpperCase() === countryCode.toUpperCase())
  let rawData: WeeklyRowRaw[] = []
  if (sheetName) {
    const sheet = workbook.Sheets[sheetName]
    rawData = XLSX.utils.sheet_to_json(sheet)
  } else {
    // Fallback: combined sheet (e.g., 'weekly_hours_viewed') with a country column
    const fallbackSheetName = workbook.SheetNames.find((n) => /weekly.*hours/i.test(n)) || workbook.SheetNames[0]
    const sheet = workbook.Sheets[fallbackSheetName]
    const allRows: WeeklyRowRaw[] = XLSX.utils.sheet_to_json(sheet)
    rawData = allRows.filter((row: any) => {
      // Normalize keys and check country code
      const possibleCountryKeys = ["country", "country_code", "country_iso", "country_iso2"]
      for (const key of Object.keys(row)) {
        const norm = key.toLowerCase().replace(/\s+/g, "_")
        if (possibleCountryKeys.includes(norm)) {
          const val = String(row[key]).toUpperCase()
          if (val === countryCode.toUpperCase()) return true
        }
      }
      return false
    })
    if (rawData.length === 0) {
      console.warn(`[v0] No rows found for country in fallback sheet: ${countryCode}`)
    }
  }

  for (const raw of rawData) {
    try {
      const weekStr = findColumnValue(raw, COLUMN_MAPPINGS.WEEK)
      const title = findColumnValue(raw, COLUMN_MAPPINGS.TITLE)
      const categoryStr = findColumnValue(raw, COLUMN_MAPPINGS.CATEGORY)
      const hoursViewed = Number(findColumnValue(raw, COLUMN_MAPPINGS.WEEKLY_HOURS))
      const views = Number(findColumnValue(raw, COLUMN_MAPPINGS.WEEKLY_VIEWS))
      const weeksInTop10 = Number(findColumnValue(raw, COLUMN_MAPPINGS.CUMULATIVE_WEEKS))

      if (!weekStr || !title || !categoryStr || isNaN(hoursViewed) || isNaN(views) || isNaN(weeksInTop10)) {
        continue
      }

      const { weekStart, weekEnd } = parseWeekToDateRange(weekStr)
      if (!weekStart || !weekEnd) continue

      // Determine category and language from category string
      const category: Category = categoryStr.toLowerCase().includes("tv") ? "TV" : "Films"
      const languageType: LanguageType = categoryStr.toLowerCase().includes("non") ? "Non-English" : "English"

      const parsed: WeeklyRow = {
        weekStart,
        weekEnd,
        title: String(title),
        category,
        languageType,
        hoursViewed,
        views,
        weeksInTop10,
        countryCode,
      }

      const validated = weeklyRowSchema.parse(parsed)
      result.push(validated)
    } catch (error) {
      console.warn(`[v0] Failed to parse country row:`, error)
    }
  }

  return result
}

/**
 * Parse most popular (91-day) data from workbook
 */
export function parseMostPopular(workbook: XLSX.WorkBook): {
  tvEnglish: PopularRow[]
  tvNonEnglish: PopularRow[]
  filmsEnglish: PopularRow[]
  filmsNonEnglish: PopularRow[]
} {
  const result = {
    tvEnglish: [] as PopularRow[],
    tvNonEnglish: [] as PopularRow[],
    filmsEnglish: [] as PopularRow[],
    filmsNonEnglish: [] as PopularRow[],
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rawData: PopularRowRaw[] = XLSX.utils.sheet_to_json(sheet)

    for (const raw of rawData) {
      try {
        const title = findColumnValue(raw, COLUMN_MAPPINGS.TITLE)
        const hours91d = Number(findColumnValue(raw, COLUMN_MAPPINGS.HOURS_91D))
        const views91d = Number(findColumnValue(raw, COLUMN_MAPPINGS.VIEWS_91D))

        if (!title || isNaN(hours91d) || isNaN(views91d)) {
          continue
        }

        // Determine category/language: prefer from sheet name; else infer from row 'category'
        let categoryLang = getCategoryAndLanguage(sheetName)
        if (!categoryLang) {
          const catStr = String(findColumnValue(raw, COLUMN_MAPPINGS.CATEGORY) || "")
          if (catStr) {
            const catLower = catStr.toLowerCase()
            const isTV = catLower.includes("tv")
            const isNon = catLower.includes("non")
            categoryLang = {
              category: (isTV ? "TV" : "Films") as Category,
              languageType: (isNon ? "Non-English" : "English") as LanguageType,
            }
          }
        }
        if (!categoryLang) continue

        const parsed: PopularRow = {
          title: String(title),
          category: categoryLang.category,
          languageType: categoryLang.languageType,
          hours91d,
          views91d,
        }

        const validated = popularRowSchema.parse(parsed)

        // Add to appropriate category
        if (validated.category === "TV" && validated.languageType === "English") {
          result.tvEnglish.push(validated)
        } else if (validated.category === "TV" && validated.languageType === "Non-English") {
          result.tvNonEnglish.push(validated)
        } else if (validated.category === "Films" && validated.languageType === "English") {
          result.filmsEnglish.push(validated)
        } else if (validated.category === "Films" && validated.languageType === "Non-English") {
          result.filmsNonEnglish.push(validated)
        }
      } catch (error) {
        console.warn(`[v0] Failed to parse popular row:`, error)
      }
    }
  }

  return result
}
