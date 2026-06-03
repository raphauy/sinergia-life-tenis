import { FixtureMatchCard } from '@/components/fixture-match-card'
import type { FeaturedMatch } from '@/services/ladder-stats-service'

/**
 * Partidos destacados (home): todo reto aceptado por venir (con o sin reserva) +
 * jugados recientes (visibles 2 días tras la fecha del partido), ordenados por
 * importancia (suma de ratings), top 7. Oculto si no hay ninguno.
 */
export function FeaturedMatches({ matches }: { matches: FeaturedMatch[] }) {
  if (matches.length === 0) return null
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-semibold">Partidos destacados</h2>
      <div className="space-y-2">
        {matches.map((fm) => (
          <FixtureMatchCard
            key={fm.match.id}
            match={fm.match}
            showDate
            player1Slug={fm.player1Slug ?? undefined}
            player2Slug={fm.player2Slug ?? undefined}
            player1Rank={fm.player1Rank}
            player2Rank={fm.player2Rank}
            reservation={fm.reservation}
            ladderPreview={fm.preview}
            ladderResultDeltas={fm.resultDeltas}
          />
        ))}
      </div>
    </section>
  )
}
