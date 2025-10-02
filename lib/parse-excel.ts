import * as XLSX from "xlsx"
import { z } from "zod"
import type { WeeklyRow, PopularRow, Category, LanguageType, WeeklyRowRaw, PopularRowRaw } from "./types"
import { SHEET_PATTERNS, COLUMN_MAPPINGS } from "./constants"

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
 * Parse week string to ISO date range
 */
function parseWeekToDateRange(weekStr: string): { weekStart: string; weekEnd: string } {
  // Expected format: "2024-01-01" or "Jan 1, 2024"
  try {
    const date = new Date(weekStr)
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date")
    }
    const weekStart = date.toISOString().split("T")[0]
    const endDate = new Date(date)
    endDate.setDate(endDate.getDate() + 6)
    const weekEnd = endDate.toISOString().split("T")[0]
    return { weekStart, weekEnd }
  } catch {
    console.warn(`[v0] Failed to parse week: ${weekStr}`)
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
    const categoryLang = getCategoryAndLanguage(sheetName)
    if (!categoryLang) continue

    const sheet = workbook.Sheets[sheetName]
    const rawData: WeeklyRowRaw[] = XLSX.utils.sheet_to_json(sheet)

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
  const sheetName = workbook.SheetNames.find((name) => name.toUpperCase() === countryCode.toUpperCase())

  if (!sheetName) {
    console.warn(`[v0] No sheet found for country: ${countryCode}`)
    return result
  }

  const sheet = workbook.Sheets[sheetName]
  const rawData: WeeklyRowRaw[] = XLSX.utils.sheet_to_json(sheet)

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
    const categoryLang = getCategoryAndLanguage(sheetName)
    if (!categoryLang) continue

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
