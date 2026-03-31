import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMatchById } from '@/services/match-service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTimeUY } from '@/lib/date-utils'
import { COURTS } from '@/lib/constants'
import { ArrowLeft } from 'lucide-react'
import { PlayerLoadResult } from './player-load-result'

interface Props {
  params: Promise<{ playerId: string; matchId: string }>
}

export default async function MatchDetailPage({ params }: Props) {
  const { playerId, matchId } = await params
  const session = await auth()

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { userId: true },
  })
  if (!player?.userId) notFound()

  const match = await getMatchById(matchId)
  if (!match) notFound()

  // Verify this player is part of the match
  const isInMatch = match.player1Id === player.userId || match.player2Id === player.userId
  if (!isInMatch) notFound()

  const isPlayer1 = match.player1Id === player.userId
  const rivalName = isPlayer1 ? match.player2.name : match.player1.name
  const court = COURTS.find((c) => c.number === match.courtNumber)

  // Can load result: match is CONFIRMED, no result, and user is this player (or admin)
  const isOwner = session?.user?.id === player.userId
  const isAdmin = session?.user?.role === 'SUPERADMIN' || session?.user?.role === 'ADMIN'
  const canLoadResult =
    match.status === 'CONFIRMED' && !match.result && (isOwner || isAdmin)

  return (
    <div className="max-w-xl">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" render={<Link href={`/jugador/${playerId}/partidos`} />}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver
      </Button>
      <div className="mb-6">
        <h1 className="text-xl font-bold">
          {match.player1.name} vs {match.player2.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {match.tournament.name} — Categoría {match.category.name}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Badge
            variant={
              match.status === 'CONFIRMED'
                ? 'default'
                : match.status === 'PLAYED'
                  ? 'secondary'
                  : 'outline'
            }
          >
            {match.status === 'CONFIRMED'
              ? 'Confirmado'
              : match.status === 'PLAYED'
                ? 'Jugado'
                : match.status === 'CANCELLED'
                  ? 'Cancelado'
                  : 'Pendiente'}
          </Badge>
        </div>
        {match.scheduledAt && (
          <p className="text-sm text-muted-foreground mt-1">
            {formatDateTimeUY(match.scheduledAt)}
            {court && ` — ${court.name}`}
          </p>
        )}
      </div>

      {/* Result */}
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

      {/* Load result form */}
      {canLoadResult && (
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Cargar resultado</h2>
          <PlayerLoadResult
            matchId={matchId}
            playerId={playerId}
            matchFormat={match.tournament.matchFormat}
            player1Id={match.player1Id}
            player2Id={match.player2Id}
            player1Name={match.player1.name || 'Jugador 1'}
            player2Name={match.player2.name || 'Jugador 2'}
          />
        </div>
      )}
    </div>
  )
}
