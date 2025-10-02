import { NextRequest } from "next/server"

function maskLen(v?: string | null) {
  if (!v) return 0
  return v.length
}

function looksLikeV4(v?: string | null) {
  if (!v) return false
  return v.startsWith("eyJ") && v.length > 100
}

function looksLikeV3(v?: string | null) {
  if (!v) return false
  return /^[a-zA-Z0-9]{32}$/.test(v)
}

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  const v4Raw = process.env.TMDB_API_KEY || ""
  const v3Raw = process.env.TMDB_API_KEY_V3 || ""

  const okV4 = looksLikeV4(v4Raw)
  const okV3 = looksLikeV3(v3Raw)

  const body = {
    v4_present: !!v4Raw,
    v4_length: maskLen(v4Raw),
    v4_looks_valid: okV4,
    v3_present: !!v3Raw,
    v3_length: maskLen(v3Raw),
    v3_looks_valid: okV3,
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  })
}
