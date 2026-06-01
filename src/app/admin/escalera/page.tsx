import type { Metadata } from 'next'
import { getActiveTournament } from '@/services/tournament-service'
import {
  getLadder,
  getLadderRanking,
  getLadderMatchesForAdmin,
  hasLadderMatches,
  proposeSeedOrder,
  SEED_BASE_RATING,
  SEED_STEP,
} from '@/services/ladder-service'
import { getLadderChallenges } from '@/services/challenge-service'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SeedEditor } from './seed-editor'
import { ResetLadderButton } from './reset-ladder-button'
import { LadderConfigForm } from './ladder-config-form'
import { AdminLadderMonitor } from './admin-ladder-monitor'

export const metadata: Metadata = { title: 'La Escalera - Admin' }

export default async function AdminEscaleraPage() {
  const ladder = await getLadder()
  const ranking = ladder ? await getLadderRanking() : []

  // Ya sembrada: panel con pestañas (ranking, actividad, ajustes).
  if (ladder && ranking.length > 0) {
    const [locked, challenges, matches] = await Promise.all([
      hasLadderMatches(ladder.id),
      getLadderChallenges(ladder.id),
      getLadderMatchesForAdmin(ladder.id),
    ])

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">La Escalera</h1>
          <p className="text-sm text-muted-foreground">
            {ranking.length} jugadores · ordenada por ranking
          </p>
        </div>

        <Tabs defaultValue="ranking">
          <TabsList className="w-full">
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="actividad">Actividad</TabsTrigger>
            <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
          </TabsList>

          <TabsContent value="ranking" className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              {locked ? (
                <p className="text-sm text-muted-foreground">
                  La escalera ya tiene partidos: no se puede re-sembrar.
                </p>
              ) : (
                <span className="text-sm text-muted-foreground">Todavía sin partidos.</span>
              )}
              <ResetLadderButton disabled={locked} />
            </div>

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
          </TabsContent>

          <TabsContent value="actividad" className="mt-4">
            <AdminLadderMonitor challenges={challenges} active={matches.active} played={matches.played} />
          </TabsContent>

          <TabsContent value="ajustes" className="mt-4">
            <LadderConfigForm
              config={{
                kFactor: ladder.kFactor,
                matchFormat: ladder.matchFormat,
                maxOpenChallenges: ladder.maxOpenChallenges,
                maxChallengesPerMonth: ladder.maxChallengesPerMonth,
                acceptanceWindowDays: ladder.acceptanceWindowDays,
                rematchCooldownDays: ladder.rematchCooldownDays,
                matchScheduleDeadlineDays: ladder.matchScheduleDeadlineDays,
                reservationLeadDays: ladder.reservationLeadDays,
                minMatchesPerMonth: ladder.minMatchesPerMonth,
                monthlyPenalty: ladder.monthlyPenalty,
                seedBaseRating: ladder.seedBaseRating,
                seedStep: ladder.seedStep,
              }}
            />
          </TabsContent>
        </Tabs>
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
