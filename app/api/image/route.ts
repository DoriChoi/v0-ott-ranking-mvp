import { NextResponse } from "next/server"

export const revalidate = 604800 // 7 days

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const size = url.searchParams.get("size") || "w342"
    const path = url.searchParams.get("path")

    if (!path) {
      return NextResponse.json({ error: "Missing 'path' query parameter" }, { status: 400 })
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`
    const tmdbUrl = `https://image.tmdb.org/t/p/${encodeURIComponent(size)}${normalizedPath}`

    const res = await fetch(tmdbUrl, {
      headers: { Accept: "image/*" },
      cache: "no-store",
    } as any)

    if (!res.ok) {
      return NextResponse.json({ error: `TMDB image fetch failed: ${res.status}` }, { status: res.status })
    }

    const contentType = res.headers.get("content-type") || "image/jpeg"
    const arrayBuf = await res.arrayBuffer()
    return new NextResponse(arrayBuf, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=604800, immutable",
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Unknown error" }, { status: 500 })
  }
}
