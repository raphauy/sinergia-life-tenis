import { notFound } from 'next/navigation'
import { formatMatchScore } from '@/lib/format-score'
import { getMatchById } from '@/services/match-service'
import { Badge } from '@/components/ui/badge'
import { formatDateTimeUY } from '@/lib/date-utils'
import { COURTS } from '@/lib/constants'
import { MatchDetailClient } from './match-detail-client'
import { MATCH_STATUS_LABELS, MATCH_STATUS_VARIANTS, stageLabel as formatStageLabel } from '@/lib/match-status'
import { getPairsForMatchSides, isDoublesMatch } from '@/services/doubles-pair-service'
import { matchSideName } from '@/lib/pair-display'
import { doublesStageLabel } from '@/lib/doubles-format'
import { blobUrl } from '@/lib/blob-url'

interface Props {
  params: Promise<{ id: string }>
}

export default async function MatchDetailPage({ params }: Props) {
  const { id } = await params
  const match = await getMatchById(id)
  if (!match) notFound()

  const court = COURTS.find((c) => c.number === match.courtNumber)

  // En dobles cada lado es una pareja (ADR 0002): el admin ve y carga por pareja,
  // no por el representante. `pairs` es null en singles y en La Escalera.
  const pairs = isDoublesMatch(match) ? await getPairsForMatchSides(match) : null
  const side1Name = matchSideName(pairs, 1, match) || 'Por definir'
  const side2Name = matchSideName(pairs, 2, match) || 'Por definir'

  // Contexto + formato según torneo XOR escalera (ADR 0001).
  const isLadder = match.ladderId != null
  const stageSuffix = formatStageLabel(match.stage) ? ` — ${formatStageLabel(match.stage)}` : ''
  const contextLabel = isLadder
    ? 'La Escalera'
    : pairs
      ? `${match.tournament?.name ?? ''} — Dobles — ${doublesStageLabel(match)}`
      : `${match.tournament?.name ?? ''} — Categoría ${match.category?.name ?? ''}${stageSuffix}`
  const matchFormat = isLadder
    ? match.ladder?.matchFormat ?? 'SINGLE_SET'
    : match.tournament?.matchFormat ?? 'SINGLE_SET'

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">
            {side1Name} vs {side2Name}
          </h1>
          <Badge variant={MATCH_STATUS_VARIANTS[match.status]}>{MATCH_STATUS_LABELS[match.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{contextLabel}</p>
        {match.scheduledAt && (
          <p className="text-sm text-muted-foreground">
            {formatDateTimeUY(match.scheduledAt)}
            {match.externalCourt ? ' — Fuera del club' : court && ` — ${court.name}`}
          </p>
        )}
        {match.selfScheduled && !match.externalCourt && (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            Lo agendó el jugador diciendo que consiguió la cancha por la app del club.
            No se reservó desde acá: conviene verificarla.
          </p>
        )}
        {match.selfScheduled && match.externalCourt && (
          <p className="mt-2 text-sm text-muted-foreground">
            Lo agendó el jugador en una cancha ajena al club.
          </p>
        )}
      </div>

      {/* Result display */}
      {match.result && (
        <div className="rounded-lg border p-4 mb-6">
          <h2 className="font-semibold mb-2">Resultado</h2>
          <p className="font-mono text-lg">
            {formatMatchScore(match.result)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Ganador: {match.result.winnerId === match.player1Id ? side1Name : side2Name}
          </p>
          {match.result.photoUrl && (
            <img
              src={blobUrl(match.result.photoUrl)}
              alt="Foto del partido"
              className="mt-3 w-full rounded-lg object-cover"
            />
          )}
        </div>
      )}

      <MatchDetailClient
        matchId={match.id}
        status={match.status}
        stage={match.stage}
        matchFormat={matchFormat}
        player1Id={match.player1Id}
        player2Id={match.player2Id}
        player1Name={side1Name}
        player2Name={side2Name}
        hasResult={!!match.result}
        scheduledAt={match.scheduledAt?.toISOString()}
        courtNumber={match.courtNumber}
        isLadder={isLadder}
        externalCourt={match.externalCourt}
        finalsDate={match.tournament?.finalsDate?.toISOString() ?? null}
        result={
          match.result
            ? {
                walkover: match.result.walkover,
                set1Player1: match.result.set1Player1,
                set1Player2: match.result.set1Player2,
                tb1Player1: match.result.tb1Player1,
                tb1Player2: match.result.tb1Player2,
                set2Player1: match.result.set2Player1,
                set2Player2: match.result.set2Player2,
                tb2Player1: match.result.tb2Player1,
                tb2Player2: match.result.tb2Player2,
                superTbPlayer1: match.result.superTbPlayer1,
                superTbPlayer2: match.result.superTbPlayer2,
                winnerId: match.result.winnerId,
              }
            : undefined
        }
      />
    </div>
  )
}
