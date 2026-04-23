import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMatchesByPlayer } from '@/services/match-service'
import { getPlayerBySlug, getPlayerSlugsByUserIds } from '@/services/player-service'
import { getReservationsByMatchIds } from '@/services/reservation-service'
import { FixtureMatchCard } from '@/components/fixture-match-card'
import { fullName } from '@/lib/format-name'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const player = await getPlayerBySlug(slug)
  if (!player) return { title: 'Partidos' }
  const name = fullName(player.user?.firstName ?? player.firstName, player.user?.lastName ?? player.lastName)
  return {
    title: `Partidos de ${name} - ${player.tournament.name}`,
    description: `Partidos y resultados de ${name} en el ${player.tournament.name}`,
  }
}

export default async function JugadorPartidosPage({ params }: Props) {
  const { slug } = await params
  const player = await getPlayerBySlug(slug)
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
    if (m.player1Id) allUserIds.add(m.player1Id)
    if (m.player2Id) allUserIds.add(m.player2Id)
  }
  const playerMap = await getPlayerSlugsByUserIds([...allUserIds])

  // Fetch reservations for pending matches
  const pendingMatchIds = upcoming.filter((m) => m.status === 'PENDING').map((m) => m.id)
  const reservations = await getReservationsByMatchIds(pendingMatchIds)
  const reservationMap = new Map(reservations.map((r) => [r.matchId, { scheduledAt: r.scheduledAt, courtNumber: r.courtNumber }]))

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
              <FixtureMatchCard
                key={m.id}
                match={m}
                showDate
                player1Slug={m.player1Id ? playerMap.get(m.player1Id) : undefined}
                player2Slug={m.player2Id ? playerMap.get(m.player2Id) : undefined}
                currentUserId={userId}
                currentPlayerSlug={slug}
                reservation={reservationMap.get(m.id)}
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
              <FixtureMatchCard
                key={m.id}
                match={m}
                showDate
                player1Slug={m.player1Id ? playerMap.get(m.player1Id) : undefined}
                player2Slug={m.player2Id ? playerMap.get(m.player2Id) : undefined}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
