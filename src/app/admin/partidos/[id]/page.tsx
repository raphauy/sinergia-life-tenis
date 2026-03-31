import { notFound } from 'next/navigation'
import { getMatchById } from '@/services/match-service'
import { Badge } from '@/components/ui/badge'
import { formatDateTimeUY } from '@/lib/date-utils'
import { COURTS } from '@/lib/constants'
import { MatchDetailClient } from './match-detail-client'

interface Props {
  params: Promise<{ id: string }>
}

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  PLAYED: 'Jugado',
  CANCELLED: 'Cancelado',
}

const statusVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline',
  CONFIRMED: 'default',
  PLAYED: 'secondary',
  CANCELLED: 'destructive',
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
            {match.player1.name} vs {match.player2.name}
          </h1>
          <Badge variant={statusVariants[match.status]}>{statusLabels[match.status]}</Badge>
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
            {match.result.set1Player1}-{match.result.set1Player2}
            {match.result.set2Player1 != null &&
              ` ${match.result.set2Player1}-${match.result.set2Player2}`}
            {match.result.superTbPlayer1 != null &&
              ` [${match.result.superTbPlayer1}-${match.result.superTbPlayer2}]`}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Ganador:{' '}
            {match.result.winnerId === match.player1Id
              ? match.player1.name
              : match.player2.name}
          </p>
        </div>
      )}

      <MatchDetailClient
        matchId={match.id}
        status={match.status}
        matchFormat={match.tournament.matchFormat}
        player1Id={match.player1Id}
        player2Id={match.player2Id}
        player1Name={match.player1.name || 'Jugador 1'}
        player2Name={match.player2.name || 'Jugador 2'}
        hasResult={!!match.result}
        result={
          match.result
            ? {
                set1Player1: match.result.set1Player1,
                set1Player2: match.result.set1Player2,
                set2Player1: match.result.set2Player1,
                set2Player2: match.result.set2Player2,
                superTbPlayer1: match.result.superTbPlayer1,
                superTbPlayer2: match.result.superTbPlayer2,
              }
            : undefined
        }
      />
    </div>
  )
}
