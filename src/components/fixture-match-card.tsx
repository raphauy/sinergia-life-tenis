'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { fullName } from '@/lib/format-name'
import { formatMatchScore } from '@/lib/format-score'
import { formatDateUY, formatTimeUY, friendlyDateTimeUY, longDateUY } from '@/lib/date-utils'
import { COURTS, TIMEZONE } from '@/lib/constants'
import { toZonedTime } from 'date-fns-tz'
import { CalendarCheck, Sun, Sunset } from 'lucide-react'
import { blobUrl } from '@/lib/blob-url'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface FixtureMatchCardProps {
  match: {
    id: string
    status: string
    stage?: string
    scheduledAt: Date | null
    courtNumber: number | null
    player1: { firstName: string | null; lastName: string | null } | null
    player2: { firstName: string | null; lastName: string | null } | null
    player1Id: string | null
    player2Id: string | null
    player1SourceGroup?: { number: number } | null
    player2SourceGroup?: { number: number } | null
    player1SourcePosition?: number | null
    player2SourcePosition?: number | null
    bracketPosition?: number | null
    category: { name: string; _count?: { matches: number } }
    group?: { id: string; number: number } | null
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
  player1Slug?: string
  player2Slug?: string
  /** Show date + time instead of only time (default: false, time only) */
  showDate?: boolean
  /** Current logged-in user ID — used to show action links only to participants */
  currentUserId?: string
  /** Current logged-in user's player slug — needed to build action hrefs */
  currentPlayerSlug?: string
  /** Reservation info if the match has a pending reservation */
  reservation?: { scheduledAt: Date; courtNumber: number } | null
  /** Fallback date when no scheduledAt (e.g. finalsDate for semis/final) */
  fallbackDate?: Date | null
}

function placeholderSlot(sourceGroupNumber: number | null | undefined, position: number | null | undefined, stage: string | undefined, bracketPosition: number | null | undefined, side: 'player1' | 'player2', qfCount: number): string {
  if (sourceGroupNumber != null && position != null) {
    return `${position}° Grupo ${sourceGroupNumber}`
  }
  if (stage === 'SEMIFINAL' && bracketPosition != null) {
    // 4 QFs: QF1+QF2→SF1, QF3+QF4→SF2. 2 QFs (3 grupos): QF1→SF1, QF2→SF2.
    const qfNum =
      qfCount === 2
        ? bracketPosition
        : (bracketPosition - 1) * 2 + (side === 'player1' ? 1 : 2)
    return `Ganador QF${qfNum}`
  }
  if (stage === 'FINAL') {
    return side === 'player1' ? 'Ganador Semifinal 1' : 'Ganador Semifinal 2'
  }
  return 'Por definir'
}

function PlayerName({
  name,
  slug,
  isWinner,
  isPlayed,
}: {
  name: string
  slug?: string
  isWinner: boolean
  isPlayed: boolean
}) {
  const weight = isPlayed ? (isWinner ? 'font-bold' : 'font-normal') : 'font-semibold'
  if (slug) {
    return (
      <Link
        href={`/jugador/${slug}`}
        onClick={(e) => e.stopPropagation()}
        className={`${weight} hover:underline`}
      >
        {name}
      </Link>
    )
  }
  return <span className={weight}>{name}</span>
}

export function FixtureMatchCard({ match, player1Slug, player2Slug, showDate = false, currentUserId, currentPlayerSlug, reservation, fallbackDate }: FixtureMatchCardProps) {
  const router = useRouter()
  const court = COURTS.find((c) => c.number === match.courtNumber)
  const qfCount = match.category._count?.matches ?? 4
  const p1Name = match.player1
    ? fullName(match.player1.firstName, match.player1.lastName) || 'Jugador 1'
    : placeholderSlot(match.player1SourceGroup?.number, match.player1SourcePosition, match.stage, match.bracketPosition, 'player1', qfCount)
  const p2Name = match.player2
    ? fullName(match.player2.firstName, match.player2.lastName) || 'Jugador 2'
    : placeholderSlot(match.player2SourceGroup?.number, match.player2SourcePosition, match.stage, match.bracketPosition, 'player2', qfCount)
  const p1Defined = match.player1 != null
  const p2Defined = match.player2 != null

  const isPlayed = match.status === 'PLAYED'
  const score = match.result ? formatMatchScore(match.result) : null
  const winnerIs1 = match.result?.winnerId != null && match.result.winnerId === match.player1Id
  const winnerIs2 = match.result?.winnerId != null && match.result.winnerId === match.player2Id
  const hasDateTime = !!match.scheduledAt
  const showFallbackDate = !hasDateTime && !!fallbackDate && (match.stage === 'SEMIFINAL' || match.stage === 'FINAL')

  const stageLabel = match.stage && match.stage !== 'GROUP'
    ? (match.stage === 'QUARTERFINAL' ? 'Cuartos de final'
      : match.stage === 'SEMIFINAL' ? `Semifinal${match.bracketPosition ? ' ' + match.bracketPosition : ''}`
      : 'Final')
    : null

  const badgeClass = "text-[10px] px-1.5 py-0 min-w-[72px] text-center justify-center font-bold"
  const statusBadge = match.status === 'PLAYED'
    ? <Badge variant="success" className={badgeClass}>Jugado</Badge>
    : match.status === 'CONFIRMED'
      ? <Badge variant="default" className={badgeClass}>Confirmado</Badge>
      : <Badge variant="warning" className={badgeClass}>Pendiente</Badge>

  function getDateTimeLabel() {
    if (!hasDateTime) return null
    if (match.status === 'PLAYED') return `${formatDateUY(match.scheduledAt!, 'dd/MM')} ${formatTimeUY(match.scheduledAt!)} hs`
    if (!showDate) return `${formatTimeUY(match.scheduledAt!)} hs`
    return friendlyDateTimeUY(match.scheduledAt!)
  }

  const dateTimeLabel = getDateTimeLabel()

  // Show action link only to participants of this match
  const isParticipant = currentUserId && currentPlayerSlug &&
    (currentUserId === match.player1Id || currentUserId === match.player2Id)
  const matchHref = isParticipant ? `/jugador/${currentPlayerSlug}/partidos/${match.id}` : null

  const actionLink = !isParticipant || !matchHref ? null
    : match.status === 'PENDING' ? (
      <Link href={matchHref} onClick={(e) => e.stopPropagation()} className="text-xs font-medium text-primary hover:underline">
        Coordinar con tu rival →
      </Link>
    ) : match.status === 'CONFIRMED' && !match.result ? (() => {
      const matchPassed = match.scheduledAt ? match.scheduledAt.getTime() <= Date.now() : true
      return matchPassed ? (
        <Link href={matchHref} onClick={(e) => e.stopPropagation()} className="text-xs font-medium text-primary hover:underline">
          Cargar resultado →
        </Link>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<span className="text-xs font-medium text-muted-foreground/50 cursor-not-allowed" onClick={(e) => e.stopPropagation()} />}>
              Cargar resultado →
            </TooltipTrigger>
            <TooltipContent>Disponible después del partido</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    })() : null

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/partido/${match.id}`)}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/partido/${match.id}`) }}
      className="rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
    >
      {/* Row 1: Player1 vs Player2 + morning/afternoon icon */}
      <div className="flex items-center justify-between text-sm">
        <div>
          <PlayerName name={p1Name} slug={p1Defined ? player1Slug : undefined} isWinner={winnerIs1} isPlayed={isPlayed} />
          <span className="text-muted-foreground mx-1.5 text-xs">vs</span>
          <PlayerName name={p2Name} slug={p2Defined ? player2Slug : undefined} isWinner={winnerIs2} isPlayed={isPlayed} />
        </div>
        {match.result?.photoUrl
          ? <img src={blobUrl(match.result.photoUrl)} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
          : hasDateTime && (
            toZonedTime(match.scheduledAt!, TIMEZONE).getHours() < 12
              ? <Sun className="h-4 w-4 text-yellow-500 shrink-0" />
              : <Sunset className="h-4 w-4 text-indigo-400 shrink-0" />
          )}
      </div>

      {/* Row 2: Category - Group/Stage (+ badge if no date/time) */}
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Categoría {match.category.name}
          {stageLabel ? ` - ${stageLabel}` : match.group && ` - Grupo ${match.group.number}`}
        </span>
        {!hasDateTime && !showFallbackDate && statusBadge}
      </div>

      {/* Row 3: Date/Time - Court + badge (only if has date/time) */}
      {hasDateTime && (
        <div className="mt-0.5 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            <span className="font-bold text-foreground">{dateTimeLabel}</span>
            {court && ` - ${court.name}`}
          </span>
          {!isPlayed && statusBadge}
        </div>
      )}

      {/* Row 3 (fallback): only date (e.g. finalsDate for SF/F without time) */}
      {!hasDateTime && showFallbackDate && fallbackDate && (
        <div className="mt-0.5 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            <span className="font-bold text-foreground">{longDateUY(fallbackDate)}</span>
          </span>
          {statusBadge}
        </div>
      )}

      {/* Row 4: Score + Winner + badge (only if played) */}
      {isPlayed && score && (
        <div className="mt-0.5 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">{score}</span>
            {match.result && (
              <span>Ganador: {winnerIs1 ? p1Name : p2Name}</span>
            )}
          </div>
          {statusBadge}
        </div>
      )}

      {/* Reservation info */}
      {reservation && match.status === 'PENDING' && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
          <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
          <span>
            Reservado {showDate ? friendlyDateTimeUY(reservation.scheduledAt) : `${formatTimeUY(reservation.scheduledAt)} hs`}          </span>
        </div>
      )}

      {/* Action link */}
      {actionLink && (
        <div className="flex justify-center mt-2 pt-2 border-t border-border/50">
          {actionLink}
        </div>
      )}
    </div>
  )
}
