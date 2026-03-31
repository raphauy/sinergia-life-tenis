import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  try {
    const blob = await get(url, { access: 'private' })

    if (!blob?.downloadUrl) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const response = await fetch(blob.downloadUrl)

    if (!response.ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': blob.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
