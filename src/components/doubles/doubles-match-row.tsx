import Link from 'next/link'
import { formatTimeUY } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { DoublesMatchView, DoublesPairView } from '@/services/doubles-view-service'

/** Nombre corto de la pareja con link a su perfil, o el texto del lado sin definir. */
export function PairName({
  pair,
  slot,
  played,
  winner,
  className,
}: {
  pair: DoublesPairView | null
  slot?: string
  played?: boolean
  winner?: boolean
  className?: string
}) {
  if (!pair) return <span className={cn('italic text-muted-foreground', className)}>{slot ?? 'Por definir'}</span>
  const weight = played ? (winner ? 'font-bold' : 'font-normal text-muted-foreground') : 'font-semibold'
  return (
    <Link href={`/pareja/${pair.slug}`} className={cn(weight, 'hover:underline', className)}>
      {pair.shortName}
    </Link>
  )
}

/**
 * Partido de dobles en dos líneas (pareja arriba, pareja abajo). A la derecha la hora y
 * la cancha si no se jugó, o el score; lleva al detalle del partido. En juego: borde rojo.
 */
export function DoublesMatchRow({ match, showLabel = false }: { match: DoublesMatchView; showLabel?: boolean }) {
  const played = match.score != null
  const time = match.scheduledAt ? formatTimeUY(match.scheduledAt) : null
  return (
    <div
      className={cn(
        'rounded-md border bg-background px-3 py-2 text-sm',
        match.live && 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
      )}
    >
      {showLabel && (
        <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary/80">{match.label}</div>
      )}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 leading-snug">
          <div className="truncate">
            <PairName pair={match.side1} slot={match.slot1} played={played} winner={match.winnerSide === 1} />
          </div>
          <div className="truncate">
            <PairName pair={match.side2} slot={match.slot2} played={played} winner={match.winnerSide === 2} />
          </div>
        </div>
        <Link href={`/partido/${match.id}`} className="shrink-0 text-right hover:opacity-80">
          {played ? (
            <>
              <div className="text-base font-bold tabular-nums">{match.score}</div>
              {time && <div className="text-[11px] text-muted-foreground">{time}{match.courtNumber != null && ` · Cancha ${match.courtNumber}`}</div>}
            </>
          ) : (
            <>
              <div className="font-bold tabular-nums">{time ?? '—'}</div>
              {match.live ? (
                <div className="text-[11px] font-bold text-red-600 dark:text-red-400">En juego{match.courtNumber != null && ` · Cancha ${match.courtNumber}`}</div>
              ) : (
                match.courtNumber != null && <div className="text-[11px] text-muted-foreground">Cancha {match.courtNumber}</div>
              )}
            </>
          )}
        </Link>
      </div>
    </div>
  )
}
