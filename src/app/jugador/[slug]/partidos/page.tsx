import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { getMatchesByPlayer } from '@/services/match-service'
import { MatchCard } from '@/components/match-card'
import { fullName } from '@/lib/format-name'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const player = await prisma.player.findUnique({
    where: { slug },
    include: {
      user: { select: { firstName: true, lastName: true } },
      tournament: { select: { name: true } },
    },
  })
  if (!player) return { title: 'Partidos' }
  const name = fullName(player.user?.firstName ?? player.firstName, player.user?.lastName ?? player.lastName)
  return {
    title: `Partidos de ${name} - ${player.tournament.name}`,
    description: `Partidos y resultados de ${name} en el ${player.tournament.name}`,
  }
}

export default async function JugadorPartidosPage({ params }: Props) {
  const { slug } = await params
  const player = await prisma.player.findUnique({
    where: { slug },
    select: { userId: true },
  })
  if (!player?.userId) notFound()
  const userId = player.userId

  const matches = await getMatchesByPlayer(userId)

  const upcoming = matches
    .filter((m) => m.status === 'CONFIRMED' || m.status === 'PENDING')
    .sort((a, b) => {
      const order = { CONFIRMED: 0, PENDING: 1 } as const
      const oa = order[a.status as keyof typeof order] ?? 1
      const ob = order[b.status as keyof typeof order] ?? 1
      if (oa !== ob) return oa - ob
      if (!a.scheduledAt) return 1
      if (!b.scheduledAt) return -1
      return a.scheduledAt.getTime() - b.scheduledAt.getTime()
    })

  const played = matches.filter((m) => m.status === 'PLAYED')

  // Build userId -> playerSlug map for linking
  const allUserIds = new Set<string>()
  for (const m of [...upcoming, ...played]) {
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
      <h1 className="text-2xl font-bold mb-6">Mis partidos</h1>

      <section className="mb-10">
        <h2 className="font-semibold mb-2">Próximos partidos ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay partidos próximos.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                player1LinkId={playerMap.get(m.player1Id)}
                player2LinkId={playerMap.get(m.player2Id)}
                coordinateHref={m.status === 'PENDING' ? `/jugador/${slug}/partidos/${m.id}` : undefined}
                resultHref={m.status === 'CONFIRMED' && !m.result ? `/jugador/${slug}/partidos/${m.id}` : undefined}
                currentUserId={userId}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Historial ({played.length})</h2>
        {played.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin partidos jugados.</p>
        ) : (
          <div className="space-y-2">
            {played.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                player1LinkId={playerMap.get(m.player1Id)}
                player2LinkId={playerMap.get(m.player2Id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
