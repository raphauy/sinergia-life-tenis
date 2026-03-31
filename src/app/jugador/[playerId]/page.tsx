import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { Button } from '@/components/ui/button'
import { getUpcomingMatches, getMatchesByPlayer } from '@/services/match-service'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import { COURTS } from '@/lib/constants'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ playerId: string }>
}): Promise<Metadata> {
  const { playerId } = await params
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      user: { select: { name: true, image: true } },
      category: { select: { name: true } },
      tournament: { select: { name: true } },
    },
  })

  if (!player) return { title: 'Jugador no encontrado' }

  const name = player.user?.name || player.name
  const title = `${name} - ${player.tournament.name} - Sinergia Life Tenis`
  const description = `${name} - Categoría ${player.category.name} - ${player.tournament.name}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      ...(player.user?.image ? { images: [{ url: player.user.image }] } : {}),
    },
  }
}

interface Props {
  params: Promise<{ playerId: string }>
}

export default async function JugadorProfilePage({ params }: Props) {
  const { playerId } = await params

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      user: { select: { id: true, name: true, image: true } },
      category: { select: { name: true } },
      tournament: { select: { name: true } },
    },
  })

  if (!player) notFound()

  const displayName = player.user?.name || player.name
  const image = player.user?.image
  const userId = player.userId

  // Fetch matches if player has a linked user
  const upcoming = userId ? await getUpcomingMatches(userId) : []
  const allMatches = userId ? await getMatchesByPlayer(userId) : []
  const recentPlayed = allMatches.filter((m) => m.status === 'PLAYED').slice(0, 5)

  function getRivalName(match: (typeof allMatches)[0]) {
    return match.player1Id === userId ? match.player2.name : match.player1.name
  }

  function isWinner(match: (typeof allMatches)[0]) {
    return match.result?.winnerId === userId
  }

  function getScore(match: (typeof allMatches)[0]) {
    if (!match.result) return ''
    const r = match.result
    let score = `${r.set1Player1}-${r.set1Player2}`
    if (r.set2Player1 != null) score += ` ${r.set2Player1}-${r.set2Player2}`
    if (r.superTbPlayer1 != null) score += ` [${r.superTbPlayer1}-${r.superTbPlayer2}]`
    return score
  }

  return (
    <div>
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-8">
        <Avatar className="h-20 w-20">
          <AvatarImage src={image || undefined} />
          <AvatarFallback className="text-2xl">
            {displayName[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{player.tournament.name}</Badge>
            <CategoryBadge name={player.category.name} />
          </div>
        </div>
      </div>

      {/* Upcoming matches */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Próximos partidos</h2>
          {userId && (
            <Button variant="ghost" size="sm" render={<Link href={`/jugador/${playerId}/partidos`} />}>
              Ver todos
            </Button>
          )}
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay partidos próximos.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((m) => (
              <Link
                key={m.id}
                href={`/jugador/${playerId}/partidos/${m.id}`}
                className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">vs {getRivalName(m)}</p>
                    <p className="text-sm text-muted-foreground">
                      {m.scheduledAt && formatDateUY(m.scheduledAt, 'EEEE dd/MM')}
                      {m.scheduledAt && ` — ${formatTimeUY(m.scheduledAt)}`}
                      {m.courtNumber && ` — ${COURTS.find((c) => c.number === m.courtNumber)?.name}`}
                    </p>
                  </div>
                  <Badge>Confirmado</Badge>
                </div>
              </Link>
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
              <Link
                key={m.id}
                href={`/jugador/${playerId}/partidos/${m.id}`}
                className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">vs {getRivalName(m)}</p>
                    <p className="text-sm font-mono">{getScore(m)}</p>
                  </div>
                  <Badge variant={isWinner(m) ? 'default' : 'secondary'}>
                    {isWinner(m) ? 'Victoria' : 'Derrota'}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
