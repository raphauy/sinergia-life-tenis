import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fullName } from '@/lib/format-name'
import { getMatchById } from '@/services/match-service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTimeUY } from '@/lib/date-utils'
import { COURTS } from '@/lib/constants'
import { ArrowLeft, MessageCircle, Mail } from 'lucide-react'
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
  const rival = isPlayer1 ? match.player2 : match.player1
  const rivalName = fullName(rival.firstName, rival.lastName)
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
          {fullName(match.player1.firstName, match.player1.lastName)} vs {fullName(match.player2.firstName, match.player2.lastName)}
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
              ? fullName(match.player1.firstName, match.player1.lastName)
              : fullName(match.player2.firstName, match.player2.lastName)}
          </p>
        </div>
      )}

      {/* Coordination message for pending matches */}
      {match.status === 'PENDING' && isOwner && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30 p-4 mb-6">
          <h2 className="font-semibold mb-2">Coordiná tu partido</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Coordiná con <span className="font-medium text-foreground">{rival.firstName || rivalName}</span> la fecha y hora en que puedan jugar y avisale a Mati para que les confirme la cancha.
            Propongan al menos 2 opciones de día y hora para facilitar la coordinación.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Datos de contacto de {rivalName}</p>
            {rival.phone && (
              <a
                href={`https://wa.me/${rival.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm hover:underline"
              >
                <MessageCircle className="h-4 w-4 text-green-600" />
                {rival.phone}
              </a>
            )}
            {rival.email && (
              <a
                href={`mailto:${rival.email}`}
                className="flex items-center gap-2 text-sm hover:underline"
              >
                <Mail className="h-4 w-4 text-muted-foreground" />
                {rival.email}
              </a>
            )}
            {!rival.phone && !rival.email && (
              <p className="text-sm text-muted-foreground">No hay datos de contacto disponibles. Consultá con el organizador.</p>
            )}
          </div>
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
            player1Name={fullName(match.player1.firstName, match.player1.lastName) || 'Jugador 1'}
            player2Name={fullName(match.player2.firstName, match.player2.lastName) || 'Jugador 2'}
          />
        </div>
      )}
    </div>
  )
}
