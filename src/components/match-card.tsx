import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { fullName } from '@/lib/format-name'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import { COURTS, TIMEZONE } from '@/lib/constants'
import { toZonedTime } from 'date-fns-tz'
import { differenceInCalendarDays } from 'date-fns'

interface MatchCardProps {
  match: {
    id: string
    status: string
    scheduledAt: Date | null
    courtNumber: number | null
    player1: { firstName: string | null; lastName: string | null }
    player2: { firstName: string | null; lastName: string | null }
    player1Id: string
    player2Id: string
    result: {
      set1Player1: number
      set1Player2: number
      set2Player1: number | null
      set2Player2: number | null
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

  const p1Name = fullName(match.player1.firstName, match.player1.lastName) || 'Jugador 1'
  const p2Name = fullName(match.player2.firstName, match.player2.lastName) || 'Jugador 2'

  function getScore() {
    if (!match.result) return null
    const r = match.result
    let score = `${r.set1Player1}-${r.set1Player2}`
    if (r.set2Player1 != null) score += `  ${r.set2Player1}-${r.set2Player2}`
    if (r.superTbPlayer1 != null) score += `  [${r.superTbPlayer1}-${r.superTbPlayer2}]`
    return score
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

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm">
          {player1LinkId ? (
            <Link href={`/jugador/${player1LinkId}`} className={`${p1Weight} hover:underline`}>
              {p1Name}
            </Link>
          ) : (
            <span className={p1Weight}>{p1Name}</span>
          )}
          <span className="text-muted-foreground mx-1">vs</span>
          {player2LinkId ? (
            <Link href={`/jugador/${player2LinkId}`} className={`${p2Weight} hover:underline`}>
              {p2Name}
            </Link>
          ) : (
            <span className={p2Weight}>{p2Name}</span>
          )}
        </div>

        {match.status === 'PLAYED' && score && (
          <span className="font-mono text-sm font-bold">{score}</span>
        )}
        {match.status === 'CONFIRMED' && (
          <Badge variant="outline" className="text-xs">Próximo</Badge>
        )}
        {coordinateHref && (
          <Link href={coordinateHref} className="text-xs font-medium text-primary hover:underline whitespace-nowrap">
            Coordinar con tu rival →
          </Link>
        )}
        {resultHref && (
          <Link href={resultHref} className="text-xs font-medium text-primary hover:underline whitespace-nowrap">
            Cargar resultado →
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between mt-1">
        <div className="text-xs text-muted-foreground">
          {match.scheduledAt && (
            <>
              {formatDateUY(match.scheduledAt, 'dd/MM')} {formatTimeUY(match.scheduledAt)}
              {court && ` — ${court.name}`}
            </>
          )}
        </div>
        {match.status === 'PLAYED' && match.result && (
          <span className="text-xs text-muted-foreground">
            Ganador: {winnerIs1 ? p1Name : p2Name}
          </span>
        )}
        {relativeDay && (
          <span className="text-xs font-medium text-muted-foreground pr-1.5">{relativeDay}</span>
        )}
      </div>

    </div>
  )
}
