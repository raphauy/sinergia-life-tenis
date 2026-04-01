import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenis.sinergialife.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [players, matches] = await Promise.all([
    prisma.player.findMany({
      where: { isActive: true, userId: { not: null } },
      select: { slug: true, updatedAt: true },
    }),
    prisma.match.findMany({
      where: { status: { in: ['PLAYED', 'CONFIRMED'] } },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
  ])

  const playerUrls: MetadataRoute.Sitemap = players.map((p) => ({
    url: `${SITE_URL}/jugador/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const matchUrls: MetadataRoute.Sitemap = matches.map((m) => ({
    url: `${SITE_URL}/partido/${m.id}`,
    lastModified: m.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  return [
    {
      url: SITE_URL,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/ranking`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/fixture`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...playerUrls,
    ...matchUrls,
  ]
}
