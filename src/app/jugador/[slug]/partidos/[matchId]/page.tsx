import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fullName } from '@/lib/format-name'
import { formatMatchScore } from '@/lib/format-score'
import { getMatchById, getMonthMatches } from '@/services/match-service'
import { getMatchRatingDeltas } from '@/services/ladder-elo-service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTimeUY, formatDateUY, formatTimeUY } from '@/lib/date-utils'
import { COURTS, TIMEZONE } from '@/lib/constants'
import { MATCH_STATUS_LABELS, MATCH_STATUS_VARIANTS } from '@/lib/match-status'
import { ArrowLeft, MessageCircle, Mail } from 'lucide-react'
import { PlayerLoadResult } from './player-load-result'
import { MatchPhoto } from './match-photo'
import { blobUrl } from '@/lib/blob-url'
import { PlayerCalendar } from '@/components/player-calendar'
import { CancelLadderMatchButton } from '@/components/cancel-ladder-match-button'
import { fetchMonthMatchesAction, fetchMonthReservationsAction, createReservationAction, cancelReservationAction } from './actions'
import { getReservationsByMonth, getReservationByMatch, mapReservationToCalendar } from '@/services/reservation-service'
import { toZonedTime } from 'date-fns-tz'

interface Props {
  params: Promise<{ slug: string; matchId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { matchId } = await params
  const match = await getMatchById(matchId)
  if (!match) return { title: 'Partido' }
  const p1 = fullName(match.player1?.firstName, match.player1?.lastName)
  const p2 = fullName(match.player2?.firstName, match.player2?.lastName)
  const context = match.ladderId ? 'La Escalera' : match.tournament?.name ?? ''
  return {
    title: `${p1} vs ${p2} - ${context}`,
    description: `${p1} vs ${p2}${match.category ? ` - Categoría ${match.category.name}` : ''} - ${context}`,
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

  // Partido polimórfico: de torneo (tournamentId/categoryId) o de escalera (ladderId).
  const isLadder = match.ladderId != null
  if (!isLadder && (match.tournamentId == null || !match.tournament || !match.category)) notFound()
  const tournament = match.tournament
  const category = match.category
  const matchFormat = isLadder
    ? match.ladder?.matchFormat ?? 'SINGLE_SET'
    : tournament?.matchFormat ?? 'SINGLE_SET'
  const contextLabel = isLadder
    ? 'La Escalera'
    : `${tournament?.name ?? ''} — Categoría ${category?.name ?? ''}`
  // Disponibilidad de canchas: global para escalera (sin filtrar por torneo).
  const availabilityTournamentId = isLadder ? undefined : match.tournamentId ?? undefined

  const isPlayer1 = match.player1Id === player.userId
  const rival = isPlayer1 ? match.player2 : match.player1
  const rivalName = fullName(rival?.firstName, rival?.lastName)
  const court = COURTS.find((c) => c.number === match.courtNumber)

  // Deltas de rating del partido de escalera ya jugado (para mostrar el cambio).
  const ratingDeltas = isLadder && match.result ? await getMatchRatingDeltas(matchId) : null
  const fmtDelta = (d: number | undefined) => (d == null ? '' : d > 0 ? `+${d}` : `${d}`)

  // Can load result: match is CONFIRMED, no result, and user is this player (or admin)
  const isOwner = session?.user?.id === player.userId
  const isAdmin = session?.user?.role === 'SUPERADMIN' || session?.user?.role === 'ADMIN'
  const matchPassed = match.scheduledAt ? match.scheduledAt.getTime() <= Date.now() : true
  const canLoadResult =
    match.status === 'CONFIRMED' && !match.result && matchPassed && (isOwner || isAdmin)

  // Partido de escalera sin jugar: se puede cancelar; aviso de plazo si lleva mucho.
  const canCancelLadder =
    isLadder && !match.result && (match.status === 'PENDING' || match.status === 'CONFIRMED') && (isOwner || isAdmin)
  const deadlineDays = match.ladder?.matchScheduleDeadlineDays ?? 3
  const deadlinePassed =
    isLadder &&
    match.status === 'PENDING' &&
    Date.now() - match.createdAt.getTime() > deadlineDays * 24 * 60 * 60 * 1000

  // Fetch court availability + reservations for pending matches
  let calendarData: {
    matches: import('@/components/court-availability-calendar').CalendarMatch[]
    reservations: import('@/components/court-availability-calendar').CalendarReservation[]
    currentReservation: import('@/components/court-availability-calendar').CalendarReservation | null
    year: number
    month: number
  } | null = null
  if (match.status === 'PENDING' && isOwner) {
    const nowUY = toZonedTime(new Date(), TIMEZONE)
    const year = nowUY.getFullYear()
    const month = nowUY.getMonth() + 1
    const [monthMatches, monthReservations, myReservation] = await Promise.all([
      getMonthMatches(availabilityTournamentId, year, month),
      getReservationsByMonth(availabilityTournamentId, year, month),
      getReservationByMatch(matchId),
    ])
    const reservationsList = monthReservations.map(mapReservationToCalendar)
    const currentRes = myReservation
      ? reservationsList.find((r) => r.matchId === matchId) ?? null
      : null
    calendarData = {
      matches: monthMatches.map((m) => ({
        scheduledAt: m.scheduledAt!.toISOString(),
        timeUY: formatTimeUY(m.scheduledAt!),
        dateUY: formatDateUY(m.scheduledAt!, 'yyyy-MM-dd'),
        courtNumber: m.courtNumber,
        player1Name: fullName(m.player1?.firstName, m.player1?.lastName),
        player2Name: fullName(m.player2?.firstName, m.player2?.lastName),
        categoryName: m.category?.name ?? '',
        groupNumber: m.group?.number ?? null,
      })),
      reservations: reservationsList,
      currentReservation: currentRes,
      year,
      month,
    }
  }

  return (
    <div className="max-w-xl">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" render={<Link href={`/jugador/${slug}/partidos`} />}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver
      </Button>
      <div className="mb-6">
        <h1 className="text-xl font-bold">
          {fullName(match.player1?.firstName, match.player1?.lastName) || 'Por definir'} vs {fullName(match.player2?.firstName, match.player2?.lastName) || 'Por definir'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {contextLabel}
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
              ? fullName(match.player1?.firstName, match.player1?.lastName)
              : fullName(match.player2?.firstName, match.player2?.lastName)}
          </p>
          {isLadder && ratingDeltas && match.player1Id && match.player2Id && (
            <p className="text-sm text-muted-foreground mt-1">
              Ranking: {fullName(match.player1?.firstName, match.player1?.lastName)}{' '}
              <span className="font-medium tabular-nums">{fmtDelta(ratingDeltas.get(match.player1Id))}</span>
              {' · '}
              {fullName(match.player2?.firstName, match.player2?.lastName)}{' '}
              <span className="font-medium tabular-nums">{fmtDelta(ratingDeltas.get(match.player2Id))}</span>
            </p>
          )}
          {match.result.photoUrl && (
            <img
              src={blobUrl(match.result.photoUrl)}
              alt="Foto del partido"
              className="mt-3 w-full rounded-lg object-cover"
            />
          )}
          {isOwner && (
            <div className="mt-3">
              <MatchPhoto
                matchId={matchId}
                hasPhoto={!!match.result.photoUrl}
              />
            </div>
          )}
        </div>
      )}

      {/* Partido de escalera sin jugar: cancelar + aviso de plazo */}
      {canCancelLadder && (
        <div className={`mb-6 flex items-center justify-between gap-3 rounded-lg border p-4 ${deadlinePassed ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' : ''}`}>
          <div className="min-w-0">
            {match.status === 'CONFIRMED' ? (
              <p className="text-sm text-muted-foreground">¿No van a poder jugar? Pueden cancelar el partido.</p>
            ) : deadlinePassed ? (
              <>
                <h2 className="font-semibold text-amber-800 dark:text-amber-300">Este partido lleva varios días sin jugarse</h2>
                <p className="text-sm text-muted-foreground">Coordinen y reserven, o cancelen el partido para liberar el cupo.</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">¿No llegan a coordinar? Pueden cancelar el partido.</p>
            )}
          </div>
          <CancelLadderMatchButton matchId={matchId} />
        </div>
      )}

      {/* Coordination message for pending matches */}
      {match.status === 'PENDING' && isOwner && rival && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30 p-4 mb-6">
          <h2 className="font-semibold mb-2">Coordiná tu partido</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Coordiná con <span className="font-medium text-foreground">{rival.firstName || rivalName}</span> la fecha y hora en que puedan jugar.
            Más abajo podés ver los horarios disponibles y reservar directamente el que les quede bien.
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Cualquier duda o cambio, escribile a Mati.
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

      {/* Court availability calendar with reservation for pending matches */}
      {match.status === 'PENDING' && isOwner && calendarData && (
        <div className="mb-6">
          <PlayerCalendar
            initialMatches={calendarData.matches}
            initialReservations={calendarData.reservations}
            tournamentId={availabilityTournamentId}
            initialYear={calendarData.year}
            initialMonth={calendarData.month}
            matchId={matchId}
            currentReservation={calendarData.currentReservation}
            reservationLeadDays={isLadder ? match.ladder?.reservationLeadDays ?? null : null}
            fetchAction={fetchMonthMatchesAction}
            fetchReservationsAction={fetchMonthReservationsAction}
            createReservationAction={createReservationAction}
            cancelReservationAction={cancelReservationAction}
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
      {canLoadResult && match.player1Id && match.player2Id && (
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Cargar resultado</h2>
          <PlayerLoadResult
            matchId={matchId}
            playerId={player.id}
            matchFormat={matchFormat}
            player1Id={match.player1Id}
            player2Id={match.player2Id}
            player1Name={fullName(match.player1?.firstName, match.player1?.lastName) || 'Jugador 1'}
            player2Name={fullName(match.player2?.firstName, match.player2?.lastName) || 'Jugador 2'}
          />
        </div>
      )}
    </div>
  )
}
