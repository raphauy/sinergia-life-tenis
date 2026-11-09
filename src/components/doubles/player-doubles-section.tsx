import Link from 'next/link'
import { Users } from 'lucide-react'
import { getDoublesTournamentView, matchesOfPair, standingOfPair } from '@/services/doubles-view-service'
import type { PairWithTournament } from '@/services/doubles-pair-service'
import { pairShortName } from '@/lib/pair-display'
import { Skeleton } from '@/components/ui/skeleton'
import { DoublesMatchRow } from './doubles-match-row'

/**
 * Sección "Dobles" del perfil de una persona: por cada pareja que integró, el torneo,
 * la pareja (link a su perfil), su lugar en el grupo y sus partidos.
 */
export async function PlayerDoublesSection({ pairs }: { pairs: PairWithTournament[] }) {
  const entries = await Promise.all(
    pairs.map(async ({ pair, tournament }) => {
      const view = await getDoublesTournamentView(pair.categoryId)
      return { pair, tournament, standing: standingOfPair(view, pair.slug), matches: matchesOfPair(view, pair.slug) }
    })
  )

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Users className="h-5 w-5 text-primary" />
        Dobles
      </h2>
      <div className="space-y-4">
        {entries.map(({ pair, tournament, standing, matches }) => (
          <div key={pair.id} className="rounded-lg border p-3">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <Link href={`/pareja/${pair.slug}`} className="font-semibold hover:underline">
                {pairShortName(pair)}
              </Link>
              <span className="text-xs text-muted-foreground">
                <Link href={`/torneo/${tournament.slug}`} className="hover:underline">
                  {tournament.name}
                </Link>
                {standing && ` · Grupo ${standing.group.letter} · ${standing.standing.position}°`}
              </span>
            </div>
            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin partidos todavía.</p>
            ) : (
              <div className="space-y-1.5">
                {matches.map((m) => (
                  <DoublesMatchRow key={m.id} match={m} showLabel />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export function PlayerDoublesSectionSkeleton() {
  return (
    <div className="mb-8">
      <Skeleton className="mb-3 h-6 w-24" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  )
}
