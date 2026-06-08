import type { Metadata } from 'next'
import { getActiveTournament } from '@/services/tournament-service'
import {
  getLadder,
  getLadderRanking,
  getLadderMatchesForAdmin,
  getLastPeriodClose,
  hasLadderMatches,
  proposeSeedOrder,
  SEED_BASE_RATING,
  SEED_STEP,
} from '@/services/ladder-service'
import { getLadderChallenges, getLadderView } from '@/services/challenge-service'
import { getWeeklyPositionMovement } from '@/services/ladder-stats-service'
import { getActivePlayerSlugByUserId } from '@/services/player-service'
import { auth } from '@/lib/auth'
import { previousMonthInUY, monthLabelUY, formatDateUY } from '@/lib/date-utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LadderTable } from '@/components/ladder-table'
import { SeedEditor } from './seed-editor'
import { ResetLadderButton } from './reset-ladder-button'
import { LadderConfigForm } from './ladder-config-form'
import { AdminLadderMonitor } from './admin-ladder-monitor'
import { LadderPeriodControls } from './ladder-period-controls'

export const metadata: Metadata = { title: 'La Escalera - Admin' }

export default async function AdminEscaleraPage() {
  const ladder = await getLadder()
  const ranking = ladder ? await getLadderRanking() : []

  // Ya sembrada: panel con pestañas (ranking, actividad, ajustes).
  if (ladder && ranking.length > 0) {
    const session = await auth()
    const viewerUserId = session?.user?.id ?? null
    const [locked, challenges, matches, lastPeriodClose, view, movement] = await Promise.all([
      hasLadderMatches(ladder.id),
      getLadderChallenges(ladder.id),
      getLadderMatchesForAdmin(ladder.id),
      getLastPeriodClose(),
      getLadderView(viewerUserId),
      getWeeklyPositionMovement(),
    ])
    const currentPlayerSlug =
      view.canChallenge && viewerUserId ? await getActivePlayerSlugByUserId(viewerUserId) : null

    // Opciones para "cerrar mes": los últimos 6 meses ya terminados (no el actual,
    // para no cerrar un mes en curso). Default = mes recién terminado.
    const { year: prevY, month: prevM } = previousMonthInUY()
    const monthOptions: { value: string; label: string }[] = []
    let oy = prevY
    let om = prevM
    for (let i = 0; i < 6; i++) {
      monthOptions.push({ value: `${oy}-${om}`, label: monthLabelUY(oy, om) })
      om--
      if (om < 1) {
        om = 12
        oy--
      }
    }
    const lastClose = lastPeriodClose
      ? {
          label: monthLabelUY(lastPeriodClose.year, lastPeriodClose.month),
          closedAtLabel: formatDateUY(lastPeriodClose.closedAt),
        }
      : null

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">La Escalera</h1>
          <p className="text-sm text-muted-foreground">
            {ranking.length} jugadores · ordenada por puntos
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

            <LadderTable
              rows={view.rows}
              canChallenge={view.canChallenge}
              currentPlayerSlug={currentPlayerSlug}
              viewerUserId={viewerUserId}
              movement={movement}
            />
          </TabsContent>

          <TabsContent value="actividad" className="mt-4 space-y-6">
            <AdminLadderMonitor challenges={challenges} active={matches.active} played={matches.played} />
            <LadderPeriodControls
              lastClose={lastClose}
              monthOptions={monthOptions}
              defaultMonth={`${prevY}-${prevM}`}
            />
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
                ratingFloor: ladder.ratingFloor,
                monthlyWarningLeadDays: ladder.monthlyWarningLeadDays,
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
