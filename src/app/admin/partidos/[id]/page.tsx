import { notFound } from 'next/navigation'
import { fullName } from '@/lib/format-name'
import { formatMatchScore } from '@/lib/format-score'
import { getMatchById } from '@/services/match-service'
import { Badge } from '@/components/ui/badge'
import { formatDateTimeUY } from '@/lib/date-utils'
import { COURTS } from '@/lib/constants'
import { MatchDetailClient } from './match-detail-client'
import { MATCH_STATUS_LABELS, MATCH_STATUS_VARIANTS } from '@/lib/match-status'
import { blobUrl } from '@/lib/blob-url'

interface Props {
  params: Promise<{ id: string }>
}

export default async function MatchDetailPage({ params }: Props) {
  const { id } = await params
  const match = await getMatchById(id)
  if (!match) notFound()

  const court = COURTS.find((c) => c.number === match.courtNumber)

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">
            {fullName(match.player1.firstName, match.player1.lastName)} vs {fullName(match.player2.firstName, match.player2.lastName)}
          </h1>
          <Badge variant={MATCH_STATUS_VARIANTS[match.status]}>{MATCH_STATUS_LABELS[match.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {match.tournament.name} — Categoría {match.category.name}
        </p>
        {match.scheduledAt && (
          <p className="text-sm text-muted-foreground">
            {formatDateTimeUY(match.scheduledAt)}
            {court && ` — ${court.name}`}
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
            Ganador:{' '}
            {match.result.winnerId === match.player1Id
              ? fullName(match.player1.firstName, match.player1.lastName)
              : fullName(match.player2.firstName, match.player2.lastName)}
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
        matchFormat={match.tournament.matchFormat}
        player1Id={match.player1Id}
        player2Id={match.player2Id}
        player1Name={fullName(match.player1.firstName, match.player1.lastName) || 'Jugador 1'}
        player2Name={fullName(match.player2.firstName, match.player2.lastName) || 'Jugador 2'}
        hasResult={!!match.result}
        scheduledAt={match.scheduledAt?.toISOString()}
        courtNumber={match.courtNumber}
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
