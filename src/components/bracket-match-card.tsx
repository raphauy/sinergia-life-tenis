'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { fullName } from '@/lib/format-name'
import { formatMatchScore } from '@/lib/format-score'
import { formatTimeUY, friendlyDateTimeUY, longDateUY } from '@/lib/date-utils'
import { COURTS } from '@/lib/constants'
import { CalendarCheck, Trophy } from 'lucide-react'

export interface BracketMatchCardMatch {
  id: string
  status: string
  stage: string
  bracketPosition: number | null
  scheduledAt: Date | null
  courtNumber: number | null
  player1: { firstName: string | null; lastName: string | null } | null
  player2: { firstName: string | null; lastName: string | null } | null
  player1Id: string | null
  player2Id: string | null
  player1SourceGroup: { number: number } | null
  player2SourceGroup: { number: number } | null
  player1SourcePosition: number | null
  player2SourcePosition: number | null
  result: {
    walkover: boolean
    set1Player1: number
    set1Player2: number
    tb1Player1: number | null
    tb1Player2: number | null
    set2Player1: number | null
    set2Player2: number | null
    tb2Player1: number | null
    tb2Player2: number | null
    superTbPlayer1: number | null
    superTbPlayer2: number | null
    winnerId: string
    photoUrl: string | null
  } | null
}

interface Props {
  match: BracketMatchCardMatch
  player1Slug?: string
  player2Slug?: string
  currentUserId?: string
  currentPlayerSlug?: string
  reservation?: { scheduledAt: Date; courtNumber: number } | null
  fallbackDate?: Date | null
  accent?: 'default' | 'final'
}

function placeholderSlot(
  sourceGroupNumber: number | null | undefined,
  position: number | null | undefined,
  stage: string,
  bracketPosition: number | null,
  side: 'player1' | 'player2',
): string {
  if (sourceGroupNumber != null && position != null) {
    return `${position}° Grupo ${sourceGroupNumber}`
  }
  if (stage === 'SEMIFINAL' && bracketPosition != null) {
    const qfNum = (bracketPosition - 1) * 2 + (side === 'player1' ? 1 : 2)
    return `Ganador QF${qfNum}`
  }
  if (stage === 'FINAL') {
    return side === 'player1' ? 'Ganador SF1' : 'Ganador SF2'
  }
  return 'Por definir'
}

function PlayerName({
  name,
  slug,
  isWinner,
  isPlayed,
  defined,
}: {
  name: string
  slug?: string
  isWinner: boolean
  isPlayed: boolean
  defined: boolean
}) {
  const weight = isPlayed ? (isWinner ? 'font-bold' : 'font-normal') : 'font-semibold'
  const italic = defined ? '' : 'italic text-muted-foreground'
  const className = `${weight} ${italic}`
  if (slug && defined) {
    return (
      <Link
        href={`/jugador/${slug}`}
        onClick={(e) => e.stopPropagation()}
        className={`${className} hover:underline`}
      >
        {name}
      </Link>
    )
  }
  return <span className={className}>{name}</span>
}

export function BracketMatchCard({
  match,
  player1Slug,
  player2Slug,
  currentUserId,
  currentPlayerSlug,
  reservation,
  fallbackDate,
  accent = 'default',
}: Props) {
  const router = useRouter()
  const court = COURTS.find((c) => c.number === match.courtNumber)

  const p1Defined = match.player1 != null
  const p2Defined = match.player2 != null
  const p1Name = p1Defined
    ? fullName(match.player1!.firstName, match.player1!.lastName) || 'Jugador 1'
    : placeholderSlot(match.player1SourceGroup?.number, match.player1SourcePosition, match.stage, match.bracketPosition, 'player1')
  const p2Name = p2Defined
    ? fullName(match.player2!.firstName, match.player2!.lastName) || 'Jugador 2'
    : placeholderSlot(match.player2SourceGroup?.number, match.player2SourcePosition, match.stage, match.bracketPosition, 'player2')

  const isPlayed = match.status === 'PLAYED'
  const score = match.result ? formatMatchScore(match.result) : null
  const winnerIs1 = match.result?.winnerId != null && match.result.winnerId === match.player1Id
  const winnerIs2 = match.result?.winnerId != null && match.result.winnerId === match.player2Id
  const hasDateTime = !!match.scheduledAt
  const showFallbackDate = !hasDateTime && !!fallbackDate && (match.stage === 'SEMIFINAL' || match.stage === 'FINAL')

  const statusBadgeClass = 'text-[10px] px-1.5 py-0 min-w-[64px] text-center justify-center font-bold'
  const statusBadge = isPlayed
    ? <Badge variant="success" className={statusBadgeClass}>Jugado</Badge>
    : match.status === 'CONFIRMED'
      ? <Badge variant="default" className={statusBadgeClass}>Confirmado</Badge>
      : <Badge variant="warning" className={statusBadgeClass}>Pendiente</Badge>

  let dateTimeLabel: string | null = null
  if (hasDateTime) {
    dateTimeLabel = isPlayed
      ? formatTimeUY(match.scheduledAt!)
      : friendlyDateTimeUY(match.scheduledAt!)
  } else if (showFallbackDate && fallbackDate) {
    dateTimeLabel = longDateUY(fallbackDate)
  }

  const isParticipant = currentUserId && currentPlayerSlug &&
    (currentUserId === match.player1Id || currentUserId === match.player2Id)
  const matchHref = isParticipant ? `/jugador/${currentPlayerSlug}/partidos/${match.id}` : null
  const canAct = isParticipant && matchHref
  const showCoordinate = canAct && match.status === 'PENDING' && p1Defined && p2Defined
  const matchPassed = match.scheduledAt ? match.scheduledAt.getTime() <= Date.now() : false
  const showLoadResult = canAct && match.status === 'CONFIRMED' && !match.result && matchPassed

  const accentClass = accent === 'final'
    ? 'border-amber-400/70 bg-amber-50/50 dark:bg-amber-950/20'
    : 'bg-background'

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/partido/${match.id}`)}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/partido/${match.id}`) }}
      className={`rounded-md border ${accentClass} p-2 cursor-pointer hover:bg-muted/50 transition-colors`}
    >
      {/* Row 1: names + status */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex-1 min-w-0 truncate">
          <PlayerName name={p1Name} slug={player1Slug} isWinner={winnerIs1} isPlayed={isPlayed} defined={p1Defined} />
          <span className="text-muted-foreground mx-1 text-xs">vs</span>
          <PlayerName name={p2Name} slug={player2Slug} isWinner={winnerIs2} isPlayed={isPlayed} defined={p2Defined} />
        </div>
        {accent === 'final' && !isPlayed && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
        {statusBadge}
      </div>

      {/* Row 2: score/winner OR date+court */}
      {isPlayed && score ? (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="font-mono font-bold">{score}</span>
          <span className="text-muted-foreground">
            Ganador: <span className="font-medium text-foreground">{winnerIs1 ? p1Name : p2Name}</span>
          </span>
        </div>
      ) : dateTimeLabel ? (
        <div className="mt-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{dateTimeLabel}</span>
          {court && <span> · {court.name}</span>}
        </div>
      ) : null}

      {/* Reservation info */}
      {reservation && match.status === 'PENDING' && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400">
          <CalendarCheck className="h-3 w-3" />
          <span>Reservado {friendlyDateTimeUY(reservation.scheduledAt)}</span>
        </div>
      )}

      {/* Action link */}
      {(showCoordinate || showLoadResult) && matchHref && (
        <div className="mt-1 pt-1 border-t border-border/40 flex justify-center">
          <Link
            href={matchHref}
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            {showCoordinate ? 'Coordinar con tu rival →' : 'Cargar resultado →'}
          </Link>
        </div>
      )}
    </div>
  )
}
