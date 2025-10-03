import * as XLSX from "xlsx"
import { z } from "zod"
import type { WeeklyRow, PopularRow, Category, LanguageType, WeeklyRowRaw, PopularRowRaw } from "./types"
import { SHEET_PATTERNS, COLUMN_MAPPINGS } from "./constants"
import { readFileSync, existsSync, statSync } from "fs"
import { join } from "path"

// Zod schemas for validation
const weeklyRowSchema = z.object({
  weekStart: z.string(),
  weekEnd: z.string(),
  title: z.string().min(1),
  category: z.enum(["TV", "Films"]),
  languageType: z.enum(["English", "Non-English"]),
  hoursViewed: z.number().nonnegative(),
  views: z.number().nonnegative(),
  weeksInTop10: z.number().int().nonnegative(),
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

// ----- JSON-first helpers -----
function tryLoadPublicJsonRowsInternal(url: string): any[] | null {
  if (!url.startsWith("/")) return null
  const jsonPath = url.replace(/\.(xlsx|xls)$/i, ".json")
  const filePath = join(process.cwd(), "public", jsonPath.slice(1))
  if (existsSync(filePath)) {
    try {
      // in-memory cache by mtime
      const key = filePath
      const mtime = statSync(filePath).mtimeMs
      ;(global as any).__v0_json_cache = (global as any).__v0_json_cache || new Map<string, { mtime: number; rows: any[] }>()
      const cache: Map<string, { mtime: number; rows: any[] }> = (global as any).__v0_json_cache
      const hit = cache.get(key)
      if (hit && hit.mtime === mtime) {
        return hit.rows
      }

      const txt = readFileSync(filePath, "utf-8")
      const data = JSON.parse(txt)
      const rows = Array.isArray(data) ? data : Array.isArray((data as any).rows) ? (data as any).rows : []
      cache.set(key, { mtime, rows })
      return rows
    } catch (e) {
      console.warn("[v0] Failed to parse JSON:", filePath, e)
      return []
    }
  }
  return null
}

export function tryLoadJsonRows(url: string): any[] | null {
  return tryLoadPublicJsonRowsInternal(url)
}

export function parseWeeklyGlobalFromRows(rows: any[]): {
  tvEnglish: WeeklyRow[]
  tvNonEnglish: WeeklyRow[]
  filmsEnglish: WeeklyRow[]
  filmsNonEnglish: WeeklyRow[]
} {
  const result = { tvEnglish: [] as WeeklyRow[], tvNonEnglish: [] as WeeklyRow[], filmsEnglish: [] as WeeklyRow[], filmsNonEnglish: [] as WeeklyRow[] }
  for (const raw of rows) {
    try {
      const weekStr = findColumnValue(raw, COLUMN_MAPPINGS.WEEK)
      const title = pickTitleWithFallback(raw)
      const hoursViewed = Number(findColumnValue(raw, COLUMN_MAPPINGS.WEEKLY_HOURS))
      const views = Number(findColumnValue(raw, COLUMN_MAPPINGS.WEEKLY_VIEWS))
      const weeksInTop10 = Number(findColumnValue(raw, COLUMN_MAPPINGS.CUMULATIVE_WEEKS))
      const catStr = String(findColumnValue(raw, COLUMN_MAPPINGS.CATEGORY) || "")
      if (!weekStr || !title || isNaN(hoursViewed) || isNaN(views) || isNaN(weeksInTop10) || !catStr) continue
      const { weekStart, weekEnd } = parseWeekToDateRange(weekStr)
      if (!weekStart || !weekEnd) continue
      const lower = catStr.toLowerCase()
      const category: Category = lower.includes("tv") ? "TV" : "Films"
      const languageType: LanguageType = lower.includes("non") ? "Non-English" : "English"
      const row: WeeklyRow = { weekStart, weekEnd, title: String(title), category, languageType, hoursViewed, views, weeksInTop10 }
      if (row.category === "TV" && row.languageType === "English") result.tvEnglish.push(row)
      else if (row.category === "TV" && row.languageType === "Non-English") result.tvNonEnglish.push(row)
      else if (row.category === "Films" && row.languageType === "English") result.filmsEnglish.push(row)
      else result.filmsNonEnglish.push(row)
    } catch {}
  }
  return result
}

export function parseCountryFromRows(rows: any[], countryCode: string): WeeklyRow[] {
  const out: WeeklyRow[] = []
  const filtered = rows.filter((r) => {
    const keys = ["country", "country_code", "country_iso", "country_iso2"]
    for (const k of Object.keys(r)) {
      const norm = k.toLowerCase().replace(/\s+/g, "_")
      if (keys.includes(norm)) {
        const v = String(r[k]).toUpperCase()
        if (v === countryCode.toUpperCase()) return true
      }
    }
    return false
  })
  for (const raw of filtered) {
    try {
      const weekStr = findColumnValue(raw, COLUMN_MAPPINGS.WEEK)
      const title = pickTitleWithFallback(raw)
      const categoryStr = findColumnValue(raw, COLUMN_MAPPINGS.CATEGORY)
      const hoursViewed = Number(findColumnValue(raw, COLUMN_MAPPINGS.WEEKLY_HOURS))
      const views = Number(findColumnValue(raw, COLUMN_MAPPINGS.WEEKLY_VIEWS))
      const weeksInTop10 = Number(findColumnValue(raw, COLUMN_MAPPINGS.CUMULATIVE_WEEKS))
      const weeklyRank = Number(findColumnValue(raw, COLUMN_MAPPINGS.RANK))
      if (!weekStr || !title || !categoryStr || isNaN(hoursViewed) || isNaN(views) || isNaN(weeksInTop10)) continue
      const { weekStart, weekEnd } = parseWeekToDateRange(weekStr)
      if (!weekStart || !weekEnd) continue
      const category: Category = String(categoryStr).toLowerCase().includes("tv") ? "TV" : "Films"
      const languageType: LanguageType = String(categoryStr).toLowerCase().includes("non") ? "Non-English" : "English"
      out.push({ weekStart, weekEnd, title: String(title), category, languageType, hoursViewed, views, weeksInTop10, countryCode, weeklyRank: isNaN(weeklyRank) ? undefined : weeklyRank })
    } catch {}
  }
  return out
}

export function parseMostPopularFromRows(rows: any[]): {
  tvEnglish: PopularRow[]
  tvNonEnglish: PopularRow[]
  filmsEnglish: PopularRow[]
  filmsNonEnglish: PopularRow[]
} {
  const result = { tvEnglish: [] as PopularRow[], tvNonEnglish: [] as PopularRow[], filmsEnglish: [] as PopularRow[], filmsNonEnglish: [] as PopularRow[] }
  for (const raw of rows) {
    try {
      const title = pickTitleWithFallback(raw)
      const hours91d = Number(findColumnValue(raw, COLUMN_MAPPINGS.HOURS_91D))
      const views91d = Number(findColumnValue(raw, COLUMN_MAPPINGS.VIEWS_91D))
      const rank = Number(findColumnValue(raw, COLUMN_MAPPINGS.RANK))
      const catStr = String(findColumnValue(raw, COLUMN_MAPPINGS.CATEGORY) || "")
      if (!title || isNaN(hours91d) || isNaN(views91d) || !catStr) continue
      const lower = catStr.toLowerCase()
      const category: Category = lower.includes("tv") ? "TV" : "Films"
      const languageType: LanguageType = lower.includes("non") ? "Non-English" : "English"
      const row: PopularRow = { title: String(title), category, languageType, hours91d, views91d, rank: isNaN(rank) ? undefined : rank }
      if (row.category === "TV" && row.languageType === "English") result.tvEnglish.push(row)
      else if (row.category === "TV" && row.languageType === "Non-English") result.tvNonEnglish.push(row)
      else if (row.category === "Films" && row.languageType === "English") result.filmsEnglish.push(row)
      else result.filmsNonEnglish.push(row)
    } catch {}
  }
  return result
}

function pickTitleWithFallback(row: any): string | undefined {
  const season = findColumnValue(row, COLUMN_MAPPINGS.SEASON_TITLE)
  const show = findColumnValue(row, COLUMN_MAPPINGS.SHOW_TITLE)
  const s = typeof season === "string" ? season.trim() : season
  const isNA = (v: any) => typeof v === "string" && v.trim().toUpperCase() === "N/A"
  if (s && !isNA(s)) return String(s)
  if (show) return String(show)
  // final fallback to generic TITLE mapping
  const t = findColumnValue(row, COLUMN_MAPPINGS.TITLE)
  return t ? String(t) : undefined
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
        const title = pickTitleWithFallback(raw)
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
      const title = pickTitleWithFallback(raw)
      const categoryStr = findColumnValue(raw, COLUMN_MAPPINGS.CATEGORY)
      const hoursViewedRaw = Number(findColumnValue(raw, COLUMN_MAPPINGS.WEEKLY_HOURS))
      const viewsRaw = Number(findColumnValue(raw, COLUMN_MAPPINGS.WEEKLY_VIEWS))
      const weeksInTop10Raw = Number(findColumnValue(raw, COLUMN_MAPPINGS.CUMULATIVE_WEEKS))
      const weeklyRank = Number(findColumnValue(raw, COLUMN_MAPPINGS.RANK))

      if (!weekStr || !title || !categoryStr) {
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
        hoursViewed: isNaN(hoursViewedRaw) ? 0 : hoursViewedRaw,
        views: isNaN(viewsRaw) ? 0 : viewsRaw,
        weeksInTop10: isNaN(weeksInTop10Raw) ? 0 : weeksInTop10Raw,
        countryCode,
        weeklyRank: isNaN(weeklyRank) ? undefined : weeklyRank,
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
        const title = pickTitleWithFallback(raw)
        const hours91d = Number(findColumnValue(raw, COLUMN_MAPPINGS.HOURS_91D))
        const views91d = Number(findColumnValue(raw, COLUMN_MAPPINGS.VIEWS_91D))
        const rank = Number(findColumnValue(raw, COLUMN_MAPPINGS.RANK))

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
          rank: isNaN(rank) ? undefined : rank,
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
