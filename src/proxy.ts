import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes
  const publicRoutes = [
    '/',
    '/login',
    '/api/auth',
    '/api/blob',
    '/invite',
    '/ranking',
    '/fixture',
    '/partido',
  ]
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || (route !== '/' && pathname.startsWith(`${route}/`))
  )

  // /jugador/[playerId] root is public (profile), sub-routes require auth
  const jugadorMatch = pathname.match(/^\/jugador\/([^/]+)$/)
  if (jugadorMatch || isPublicRoute) {
    return NextResponse.next()
  }

  // Get JWT token
  const isProduction = process.env.NODE_ENV === 'production'
  const cookieName = isProduction
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName,
  })

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verify user exists and is active
  const user = await prisma.user.findUnique({
    where: { id: token.id as string },
    select: { isActive: true, role: true },
  })

  if (!user || !user.isActive) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('authjs.session-token')
    response.cookies.delete('__Secure-authjs.session-token')
    return response
  }

  // Admin routes: SUPERADMIN + ADMIN only
  if (pathname.startsWith('/admin')) {
    if (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    // /admin/invitaciones: SUPERADMIN only
    if (pathname.startsWith('/admin/invitaciones') && user.role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    return NextResponse.next()
  }

  // /jugador/[slug]/* sub-routes: authenticated users
  const jugadorSubRoute = pathname.match(/^\/jugador\/([^/]+)\//)
  if (jugadorSubRoute) {
    // PLAYER can only access own player
    if (user.role === 'PLAYER') {
      const slug = jugadorSubRoute[1]
      const player = await prisma.player.findFirst({
        where: { slug, userId: token.id as string },
        select: { id: true },
      })
      if (!player) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
