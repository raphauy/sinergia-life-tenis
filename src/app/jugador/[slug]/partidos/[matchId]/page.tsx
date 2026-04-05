import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fullName } from '@/lib/format-name'
import { formatMatchScore } from '@/lib/format-score'
import { getMatchById, getMonthMatches } from '@/services/match-service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTimeUY, formatDateUY, formatTimeUY } from '@/lib/date-utils'
import { COURTS, TIMEZONE } from '@/lib/constants'
import { MATCH_STATUS_LABELS, MATCH_STATUS_VARIANTS } from '@/lib/match-status'
import { ArrowLeft, MessageCircle, Mail } from 'lucide-react'
import { PlayerLoadResult } from './player-load-result'
import { CourtAvailabilityCalendar } from '@/components/court-availability-calendar'
import { toZonedTime } from 'date-fns-tz'

interface Props {
  params: Promise<{ slug: string; matchId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { matchId } = await params
  const match = await getMatchById(matchId)
  if (!match) return { title: 'Partido' }
  const p1 = fullName(match.player1.firstName, match.player1.lastName)
  const p2 = fullName(match.player2.firstName, match.player2.lastName)
  return {
    title: `${p1} vs ${p2} - ${match.tournament.name}`,
    description: `${p1} vs ${p2} - Categoría ${match.category.name} - ${match.tournament.name}`,
  }
}

export default async function MatchDetailPage({ params }: Props) {
  const { slug, matchId } = await params
  const session = await auth()

  const player = await prisma.player.findUnique({
    where: { slug },
    select: { id: true, userId: true },
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
  const matchPassed = match.scheduledAt ? match.scheduledAt.getTime() <= Date.now() : true
  const canLoadResult =
    match.status === 'CONFIRMED' && !match.result && matchPassed && (isOwner || isAdmin)

  // Fetch court availability for pending matches
  let calendarMatches: { scheduledAt: string; timeUY: string; dateUY: string; courtNumber: number | null; player1Name: string; player2Name: string; categoryName: string; groupNumber: number | null }[] | null = null
  let calendarYear = 0
  let calendarMonth = 0
  if (match.status === 'PENDING' && isOwner) {
    const nowUY = toZonedTime(new Date(), TIMEZONE)
    calendarYear = nowUY.getFullYear()
    calendarMonth = nowUY.getMonth() + 1
    const monthMatches = await getMonthMatches(match.tournamentId, calendarYear, calendarMonth)
    calendarMatches = monthMatches.map((m) => ({
      scheduledAt: m.scheduledAt!.toISOString(),
      timeUY: formatTimeUY(m.scheduledAt!),
      dateUY: formatDateUY(m.scheduledAt!, 'yyyy-MM-dd'),
      courtNumber: m.courtNumber,
      player1Name: fullName(m.player1.firstName, m.player1.lastName),
      player2Name: fullName(m.player2.firstName, m.player2.lastName),
      categoryName: m.category.name,
      groupNumber: m.group?.number ?? null,
    }))
  }

  return (
    <div className="max-w-xl">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" render={<Link href={`/jugador/${slug}/partidos`} />}>
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
          <Badge variant={MATCH_STATUS_VARIANTS[match.status] || 'outline'}>
            {MATCH_STATUS_LABELS[match.status] || match.status}
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
            {formatMatchScore(match.result)}
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
            Más abajo podés ver los horarios que ya tienen partidos confirmados.
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

      {/* Court availability calendar for pending matches */}
      {match.status === 'PENDING' && isOwner && calendarMatches && (
        <div className="mb-6">
          <CourtAvailabilityCalendar
            initialMatches={calendarMatches}
            tournamentId={match.tournamentId}
            initialYear={calendarYear}
            initialMonth={calendarMonth}
          />
        </div>
      )}

      {/* Load result - waiting for match */}
      {match.status === 'CONFIRMED' && !match.result && !matchPassed && (isOwner || isAdmin) && (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Podrás cargar el resultado una vez que se juegue el partido.
        </div>
      )}

      {/* Load result form */}
      {canLoadResult && (
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Cargar resultado</h2>
          <PlayerLoadResult
            matchId={matchId}
            playerId={player.id}
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
