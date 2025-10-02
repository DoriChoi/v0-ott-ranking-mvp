import { NextRequest } from "next/server"

const TMDB_IMAGE_HOST = "https://image.tmdb.org"
const DEFAULT_SIZE = "w342" // keep in sync with lib/enrich.ts

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const path = searchParams.get("path") || ""
    const size = searchParams.get("size") || DEFAULT_SIZE

    // Basic validation
    if (!path || !path.startsWith("/")) {
      return new Response(JSON.stringify({ error: "missing_or_invalid_path" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Build TMDB URL
    const tmdbUrl = `${TMDB_IMAGE_HOST}/t/p/${encodeURIComponent(size)}${path}`

    const upstream = await fetch(tmdbUrl, {
      // Let the CDN cache this aggressively. You can tune further as needed.
      next: { revalidate: 60 * 60 * 24 },
    })

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: "upstream_error", status: upstream.status }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      })
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg"
    const arrayBuf = await upstream.arrayBuffer()

    return new Response(Buffer.from(arrayBuf), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache on CDN/proxy for a day, allow stale while revalidate
        "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "internal_error", detail: e?.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
