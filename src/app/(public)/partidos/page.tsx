import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getActivePlayerSlugByUserId } from '@/services/player-service'
import { getPendingChallenges } from '@/services/challenge-service'
import { getLadderMatches } from '@/services/ladder-stats-service'
import { FixtureMatchCard } from '@/components/fixture-match-card'
import { LadderPendingChallenges } from '@/components/ladder-pending-challenges'

export const metadata: Metadata = {
  title: 'Partidos - La Escalera',
  description: 'Retos y partidos de La Escalera de Life Montevideo.',
}

export default async function PartidosPage() {
  const session = await auth()
  const currentUserId = session?.user?.id
  const currentPlayerSlug = currentUserId
    ? (await getActivePlayerSlugByUserId(currentUserId)) ?? undefined
    : undefined

  const [pending, { upcoming, played }] = await Promise.all([
    getPendingChallenges(),
    getLadderMatches(),
  ])

  const empty = pending.length === 0 && upcoming.length === 0 && played.length === 0

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Partidos</h1>
          <p className="text-muted-foreground text-sm">La Escalera</p>
        </div>
        <Link
          href="/calendario"
          className="flex items-center gap-1.5 text-sm text-primary hover:underline shrink-0 mt-1"
        >
          <CalendarDays className="h-4 w-4" />
          Ver calendario
        </Link>
      </div>

      {empty ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay retos ni partidos en La Escalera.
        </p>
      ) : (
        <div className="space-y-8">
          <LadderPendingChallenges challenges={pending} />

          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-bold">Próximos partidos ({upcoming.length})</h2>
              <div className="space-y-2">
                {upcoming.map((item) => (
                  <FixtureMatchCard
                    key={item.match.id}
                    match={item.match}
                    showDate
                    player1Slug={item.player1Slug ?? undefined}
                    player2Slug={item.player2Slug ?? undefined}
                    player1Rank={item.player1Rank}
                    player2Rank={item.player2Rank}
                    currentUserId={currentUserId}
                    currentPlayerSlug={currentPlayerSlug}
                    reservation={item.reservation}
                    ladderPreview={item.preview}
                  />
                ))}
              </div>
            </section>
          )}

          {played.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-bold">Resultados ({played.length})</h2>
              <div className="space-y-2">
                {played.map((item) => (
                  <FixtureMatchCard
                    key={item.match.id}
                    match={item.match}
                    showDate
                    player1Slug={item.player1Slug ?? undefined}
                    player2Slug={item.player2Slug ?? undefined}
                    player1Rank={item.player1Rank}
                    player2Rank={item.player2Rank}
                    currentUserId={currentUserId}
                    currentPlayerSlug={currentPlayerSlug}
                    ladderResultDeltas={item.resultDeltas}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
