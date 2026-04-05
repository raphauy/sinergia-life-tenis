'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { fullName } from '@/lib/format-name'
import { formatMatchScore } from '@/lib/format-score'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import { COURTS, TIMEZONE } from '@/lib/constants'
import { toZonedTime } from 'date-fns-tz'
import { differenceInCalendarDays } from 'date-fns'
import { Sun, Sunset } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface FixtureMatchCardProps {
  match: {
    id: string
    status: string
    scheduledAt: Date | null
    courtNumber: number | null
    player1: { firstName: string | null; lastName: string | null }
    player2: { firstName: string | null; lastName: string | null }
    player1Id: string
    player2Id: string
    category: { name: string }
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

export function FixtureMatchCard({ match, player1Slug, player2Slug, showDate = false, currentUserId, currentPlayerSlug }: FixtureMatchCardProps) {
  const router = useRouter()
  const court = COURTS.find((c) => c.number === match.courtNumber)
  const p1Name = fullName(match.player1.firstName, match.player1.lastName) || 'Jugador 1'
  const p2Name = fullName(match.player2.firstName, match.player2.lastName) || 'Jugador 2'

  const isPlayed = match.status === 'PLAYED'
  const score = match.result ? formatMatchScore(match.result) : null
  const winnerIs1 = match.result?.winnerId === match.player1Id
  const winnerIs2 = match.result?.winnerId === match.player2Id
  const hasDateTime = !!match.scheduledAt

  const badgeClass = "text-[10px] px-1.5 py-0 min-w-[72px] text-center justify-center font-bold"
  const statusBadge = match.status === 'PLAYED'
    ? <Badge variant="success" className={badgeClass}>Jugado</Badge>
    : match.status === 'CONFIRMED'
      ? <Badge variant="default" className={badgeClass}>Confirmado</Badge>
      : <Badge variant="warning" className={badgeClass}>Pendiente</Badge>

  function getDateTimeLabel() {
    if (!hasDateTime) return null
    const time = `${formatTimeUY(match.scheduledAt!)} hs`
    if (!showDate) return time

    if (match.status !== 'PLAYED') {
      const nowUY = toZonedTime(new Date(), TIMEZONE)
      const scheduledUY = toZonedTime(match.scheduledAt!, TIMEZONE)
      const diff = differenceInCalendarDays(scheduledUY, nowUY)
      if (diff === 0) return `Hoy ${time}`
      if (diff === 1) return `Mañana ${time}`
      if (diff >= 2 && diff <= 6) {
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        return `${days[scheduledUY.getDay()]} ${time}`
      }
    }
    return `${formatDateUY(match.scheduledAt!, 'dd/MM')} ${time}`
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
          <PlayerName name={p1Name} slug={player1Slug} isWinner={winnerIs1} isPlayed={isPlayed} />
          <span className="text-muted-foreground mx-1.5 text-xs">vs</span>
          <PlayerName name={p2Name} slug={player2Slug} isWinner={winnerIs2} isPlayed={isPlayed} />
        </div>
        {hasDateTime && (
          toZonedTime(match.scheduledAt!, TIMEZONE).getHours() < 12
            ? <Sun className="h-4 w-4 text-yellow-500 shrink-0" />
            : <Sunset className="h-4 w-4 text-indigo-400 shrink-0" />
        )}
      </div>

      {/* Row 2: Category - Group (+ badge if no date/time) */}
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Categoría {match.category.name}
          {match.group && ` - Grupo ${match.group.number}`}
        </span>
        {!hasDateTime && statusBadge}
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

      {/* Row 4: Score + Winner + badge (only if played) */}
      {isPlayed && score && (
        <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-foreground">{score}</span>
            {match.result && (
              <span>Ganador: {winnerIs1 ? p1Name : p2Name}</span>
            )}
          </div>
          {statusBadge}
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
