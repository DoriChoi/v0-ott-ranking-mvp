import { readFileSync } from 'fs'
import { join, extname } from 'path'
import * as XLSX from 'xlsx'
import { parse } from 'csv-parse/sync'

const ROOT = process.cwd()

export function readLocalBuffer(relPath: string) {
  const full = join(ROOT, relPath)
  return readFileSync(full)
}

export function parseXlsxRowsFromBuffer(buf: Buffer | ArrayBuffer) {
  const wb = XLSX.read(buf, { type: 'buffer' as any })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null })
  return rows
}

export function parseCsvRowsFromBuffer(buf: Buffer) {
  const rows = parse(buf, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as any[]
  return rows
}

export function loadLocalSpreadsheetRows(relPath: string) {
  const ext = extname(relPath).toLowerCase()
  const buf = readLocalBuffer(relPath)
  if (ext === '.xlsx' || ext === '.xls') {
    try {
      return parseXlsxRowsFromBuffer(buf)
    } catch (e) {
      const csvPath = relPath.replace(/\.(xlsx|xls)$/i, '.csv')
      const csvBuf = readLocalBuffer(csvPath)
      return parseCsvRowsFromBuffer(csvBuf as Buffer)
    }
  }
  if (ext === '.csv') {
    return parseCsvRowsFromBuffer(buf as Buffer)
  }
  throw new Error(`Unsupported file extension: ${ext}`)
}
