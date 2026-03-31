import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  try {
    const result = await get(url, { access: 'private' })

    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const contentType = result.headers.get('Content-Type') || 'image/jpeg'

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
