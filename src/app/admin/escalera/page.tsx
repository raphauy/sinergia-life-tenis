import type { Metadata } from 'next'
import { getActiveTournament } from '@/services/tournament-service'
import {
  getLadder,
  getLadderRanking,
  hasLadderMatches,
  proposeSeedOrder,
  SEED_BASE_RATING,
  SEED_STEP,
} from '@/services/ladder-service'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SeedEditor } from './seed-editor'
import { ResetLadderButton } from './reset-ladder-button'

export const metadata: Metadata = { title: 'La Escalera - Admin' }

export default async function AdminEscaleraPage() {
  const ladder = await getLadder()
  const ranking = ladder ? await getLadderRanking() : []

  // Ya sembrada: vista read-only + re-sembrar (si no hay partidos todavía)
  if (ladder && ranking.length > 0) {
    const locked = await hasLadderMatches(ladder.id)
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">La Escalera</h1>
            <p className="text-sm text-muted-foreground">
              {ranking.length} jugadores · ordenada por ranking
            </p>
          </div>
          <ResetLadderButton disabled={locked} />
        </div>

        {locked && (
          <p className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            La escalera ya tiene partidos: no se puede re-sembrar.
          </p>
        )}

        <div className="rounded-md border divide-y">
          {ranking.map((e) => (
            <div key={e.userId} className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 text-center text-sm font-bold tabular-nums">{e.position}</span>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={e.image || undefined} />
                <AvatarFallback className="text-xs">{(e.name[0] || '?').toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate text-sm font-medium">{e.name}</span>
              <span className="text-sm font-bold tabular-nums">{e.rating}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Sin sembrar: proponer desde el torneo activo
  const tournament = await getActiveTournament()
  if (!tournament) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">La Escalera</h1>
        <p className="text-sm text-muted-foreground">
          No hay torneo activo desde el cual sembrar la escalera.
        </p>
      </div>
    )
  }

  const proposal = await proposeSeedOrder(tournament.id)

  return (
    <SeedEditor
      proposal={proposal}
      baseRating={SEED_BASE_RATING}
      step={SEED_STEP}
      tournamentName={tournament.name}
    />
  )
}
