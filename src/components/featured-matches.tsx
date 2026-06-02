import { FixtureMatchCard } from '@/components/fixture-match-card'
import type { FeaturedMatch } from '@/services/ladder-stats-service'

/**
 * Partidos destacados de la semana (home): próximos confirmados + jugados de la
 * semana, ordenados por importancia (suma de ratings). Oculto si no hay ninguno.
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
            ladderPreview={fm.preview}
            ladderResultDeltas={fm.resultDeltas}
          />
        ))}
      </div>
    </section>
  )
}
