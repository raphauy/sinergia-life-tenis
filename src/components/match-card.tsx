import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { fullName } from '@/lib/format-name'
import { formatMatchScore } from '@/lib/format-score'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import { COURTS, TIMEZONE } from '@/lib/constants'
import { toZonedTime } from 'date-fns-tz'
import { differenceInCalendarDays } from 'date-fns'
import { Eye } from 'lucide-react'

interface MatchCardProps {
  match: {
    id: string
    status: string
    scheduledAt: Date | null
    courtNumber: number | null
    player1: { firstName: string | null; lastName: string | null } | null
    player2: { firstName: string | null; lastName: string | null } | null
    player1Id: string | null
    player2Id: string | null
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
  player1LinkId?: string
  player2LinkId?: string
  /** Link and current user ID to show "Coordiná con [rival]..." for pending matches */
  coordinateHref?: string
  /** Link to load result for confirmed matches */
  resultHref?: string
  currentUserId?: string
}

export function MatchCard({ match, player1LinkId, player2LinkId, coordinateHref, resultHref, currentUserId }: MatchCardProps) {
  const court = COURTS.find((c) => c.number === match.courtNumber)

  const p1Name = match.player1
    ? fullName(match.player1.firstName, match.player1.lastName) || 'Jugador 1'
    : 'Por definir'
  const p2Name = match.player2
    ? fullName(match.player2.firstName, match.player2.lastName) || 'Jugador 2'
    : 'Por definir'

  function getScore() {
    if (!match.result) return null
    return formatMatchScore(match.result)
  }

  function getRelativeDay() {
    if (!match.scheduledAt || match.status === 'PLAYED') return null
    const now = toZonedTime(new Date(), TIMEZONE)
    const scheduled = toZonedTime(match.scheduledAt, TIMEZONE)
    const diff = differenceInCalendarDays(scheduled, now)
    if (diff < 0) return 'Finalizado'
    if (diff === 0) return 'Hoy'
    if (diff === 1) return 'Mañana'
    if (diff <= 6) {
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      return days[scheduled.getDay()]
    }
    return `En ${diff} días`
  }

  const score = getScore()
  const relativeDay = getRelativeDay()
  const winnerIs1 = match.result?.winnerId === match.player1Id
  const winnerIs2 = match.result?.winnerId === match.player2Id
  const p1Weight = winnerIs1 ? 'font-bold' : 'font-medium'
  const p2Weight = winnerIs2 ? 'font-bold' : 'font-medium'

  const statusBadge = match.status === 'PLAYED'
    ? <Badge variant="success" className="text-xs">Jugado</Badge>
    : match.status === 'CONFIRMED'
      ? <Badge variant="default" className="text-xs">Confirmado</Badge>
      : match.status === 'CANCELLED'
        ? <Badge variant="destructive" className="text-xs">Cancelado</Badge>
        : <Badge variant="outline" className="text-xs">Pendiente</Badge>

  const p1Link = player1LinkId ? (
    <Link href={`/jugador/${player1LinkId}`} className={`${p1Weight} hover:underline`}>{p1Name}</Link>
  ) : (
    <span className={p1Weight}>{p1Name}</span>
  )
  const p2Link = player2LinkId ? (
    <Link href={`/jugador/${player2LinkId}`} className={`${p2Weight} hover:underline`}>{p2Name}</Link>
  ) : (
    <span className={p2Weight}>{p2Name}</span>
  )

  const metaInfo = (
    <>
      {match.group && <span>Grupo {match.group.number}</span>}
      {match.group && match.scheduledAt && <span> · </span>}
      {match.scheduledAt && (
        <>
          {formatDateUY(match.scheduledAt, 'dd/MM')} {formatTimeUY(match.scheduledAt)}
          {court && ` — ${court.name}`}
        </>
      )}
    </>
  )

  const actionLink = coordinateHref ? (
    <Link href={coordinateHref} className="text-xs font-medium text-primary hover:underline whitespace-nowrap">
      Coordinar con tu rival →
    </Link>
  ) : resultHref ? (() => {
    const matchPassed = match.scheduledAt ? match.scheduledAt.getTime() <= Date.now() : true
    return matchPassed ? (
      <Link href={resultHref} className="text-xs font-medium text-primary hover:underline whitespace-nowrap">
        Cargar resultado →
      </Link>
    ) : (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<span className="text-xs font-medium text-muted-foreground/50 whitespace-nowrap cursor-not-allowed" />}>
            Cargar resultado →
          </TooltipTrigger>
          <TooltipContent>Disponible después del partido</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  })() : null

  return (
    <div className="rounded-lg border p-3 md:p-3">
      {/* ===== MOBILE layout (< md): scoreboard style ===== */}
      <div className="md:hidden">
        {/* Names: symmetric grid */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 text-sm">
          <div className="min-w-0 text-right">{p1Link}</div>
          <span className="text-muted-foreground/50 text-[11px] font-light">vs</span>
          <div className="min-w-0">{p2Link}</div>
        </div>

        {/* Score (played matches) */}
        {match.status === 'PLAYED' && score && (
          <div className="text-center mt-1.5">
            <Link href={`/partido/${match.id}`} className="font-mono text-sm font-bold hover:underline">
              {score}
            </Link>
          </div>
        )}

        {/* Winner (played matches) */}
        {match.status === 'PLAYED' && match.result && (
          <p className="text-center text-xs text-muted-foreground mt-1.5">
            Ganador: {winnerIs1 ? p1Name : p2Name}
          </p>
        )}

        {/* Meta row: group/date | status + eye */}
        <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
          <div>{metaInfo}</div>
          <div className="flex items-center gap-1.5">
            {relativeDay && <span className="font-medium">{relativeDay}</span>}
            {statusBadge}
            <Link href={`/partido/${match.id}`} className="text-muted-foreground/60 hover:text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Action */}
        {actionLink && (
          <div className="flex justify-center mt-2 pt-2 border-t border-border/50">
            {actionLink}
          </div>
        )}
      </div>

      {/* ===== DESKTOP layout (≥ md): original inline style ===== */}
      <div className="hidden md:block">
        {/* Row 1: names + eye | status badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm">
            {p1Link}
            <span className="text-muted-foreground mx-1">vs</span>
            {p2Link}
            <Link href={`/partido/${match.id}`} className="text-muted-foreground/60 hover:text-muted-foreground ml-1">
              <Eye className="h-3.5 w-3.5" />
            </Link>
          </div>
          {statusBadge}
        </div>

        {/* Row 2: group/date/court | score/actions */}
        <div className="flex items-center justify-between mt-1">
          <div className="text-xs text-muted-foreground">{metaInfo}</div>
          <div className="flex items-center gap-2">
            {match.status === 'PLAYED' && score && (
              <Link href={`/partido/${match.id}`} className="font-mono text-sm font-bold hover:underline">
                {score}
              </Link>
            )}
            {match.status === 'PLAYED' && match.result && (
              <span className="text-xs text-muted-foreground">
                Ganador: {winnerIs1 ? p1Name : p2Name}
              </span>
            )}
            {actionLink}
            {relativeDay && (
              <span className="text-xs font-medium text-muted-foreground">
                {relativeDay}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
