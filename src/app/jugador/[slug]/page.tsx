import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { SITE_URL } from '@/lib/site-url'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { blobUrl } from '@/lib/blob-url'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { Button } from '@/components/ui/button'
import { FixtureMatchCard } from '@/components/fixture-match-card'
import { getUpcomingMatches, getMatchesByPlayer } from '@/services/match-service'
import { fullName, initials } from '@/lib/format-name'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const player = await prisma.player.findUnique({
    where: { slug },
    include: {
      user: { select: { firstName: true, lastName: true, image: true } },
      category: { select: { name: true } },
      tournament: { select: { name: true } },
      group: { select: { number: true } },
    },
  })

  if (!player) return { title: 'Jugador no encontrado' }

  const name = player.user
    ? fullName(player.user.firstName, player.user.lastName)
    : fullName(player.firstName, player.lastName)
  const title = `${name} - ${player.tournament.name}`
  const groupSuffix = player.group ? `, Grupo ${player.group.number}` : ''
  const description = `Perfil de ${name} - Categoría ${player.category.name}${groupSuffix} - ${player.tournament.name}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      ...(player.user?.image ? { images: [{ url: `${SITE_URL}/api/blob?url=${encodeURIComponent(player.user.image)}` }] } : {}),
    },
  }
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function JugadorProfilePage({ params }: Props) {
  const { slug } = await params

  const player = await prisma.player.findUnique({
    where: { slug },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, image: true } },
      category: { select: { name: true } },
      tournament: { select: { name: true } },
      group: { select: { number: true } },
    },
  })

  if (!player) notFound()

  const session = await auth()
  const isOwner = session?.user?.id === player.userId
  const isAdmin = session?.user?.role === 'SUPERADMIN' || session?.user?.role === 'ADMIN'
  const canAct = isOwner || isAdmin

  const displayName = fullName(player.user?.firstName ?? player.firstName, player.user?.lastName ?? player.lastName)
  const image = blobUrl(player.user?.image)
  const userId = player.userId

  // Fetch matches if player has a linked user
  const upcomingRaw = userId ? await getUpcomingMatches(userId) : []
  const allMatches = userId ? await getMatchesByPlayer(userId) : []
  const recentPlayed = allMatches.filter((m) => m.status === 'PLAYED').slice(0, 5)

  // Sort upcoming: confirmed first, then by date
  const upcoming = [...upcomingRaw].sort((a, b) => {
    const order = { CONFIRMED: 0, PENDING: 1 } as const
    const oa = order[a.status as keyof typeof order] ?? 1
    const ob = order[b.status as keyof typeof order] ?? 1
    if (oa !== ob) return oa - ob
    if (!a.scheduledAt) return 1
    if (!b.scheduledAt) return -1
    return a.scheduledAt.getTime() - b.scheduledAt.getTime()
  })

  // Build userId -> playerSlug map for linking
  const allUserIds = new Set<string>()
  for (const m of [...upcoming, ...recentPlayed]) {
    allUserIds.add(m.player1Id)
    allUserIds.add(m.player2Id)
  }
  const playerLinks = await prisma.player.findMany({
    where: { userId: { in: [...allUserIds] }, isActive: true },
    select: { slug: true, userId: true },
  })
  const playerMap = new Map(playerLinks.map((p) => [p.userId!, p.slug]))

  return (
    <div>
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-8">
        <Avatar className="h-20 w-20">
          <AvatarImage src={image || undefined} />
          <AvatarFallback className="text-2xl">
            {initials(player.user?.firstName ?? player.firstName, player.user?.lastName ?? player.lastName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="rounded-md">{player.tournament.name}</Badge>
            <CategoryBadge name={player.category.name} />
            {player.group && (
              <Badge variant="outline" className="rounded-md">Grupo {player.group.number}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming matches */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Próximos partidos</h2>
          {userId && (
            <Button variant="ghost" size="sm" render={<Link href={`/jugador/${slug}/partidos`} />}>
              Ver todos
            </Button>
          )}
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay partidos próximos.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((m) => (
              <FixtureMatchCard
                key={m.id}
                match={m}
                showDate
                player1Slug={playerMap.get(m.player1Id)}
                player2Slug={playerMap.get(m.player2Id)}
                currentUserId={canAct ? userId ?? undefined : undefined}
                currentPlayerSlug={canAct ? slug : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent history */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Historial reciente</h2>
        {recentPlayed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay partidos jugados.</p>
        ) : (
          <div className="space-y-2">
            {recentPlayed.map((m) => (
              <FixtureMatchCard
                key={m.id}
                match={m}
                showDate
                player1Slug={playerMap.get(m.player1Id)}
                player2Slug={playerMap.get(m.player2Id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
