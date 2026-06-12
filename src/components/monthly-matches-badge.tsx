import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { formatDateUY } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { MonthlyMatchDetail } from '@/services/ladder-stats-service'

const MAX_BALLS = 5

/** Pelota de tenis (SVG liviano): círculo amarillo-verde con la costura blanca. */
function TennisBall({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#c2e53a" stroke="#9bbb1f" strokeWidth="0.75" />
      <path
        d="M4.8 6 Q 11 12 4.8 18 M19.2 6 Q 13 12 19.2 18"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Pelotitas de tenis por partidos de escalera jugados en el mes corriente: una 🎾
 * por partido, con tope de 5 íconos + el número de la cuenta si jugó más (mismo
 * criterio que los fueguitos). Tap → Dialog con la lista de rivales y resultados de
 * esos partidos (mobile-first). No renderiza nada si jugó 0.
 */
export function MonthlyMatchesBadge({
  matches,
  playerName,
  className,
}: {
  matches: MonthlyMatchDetail[]
  playerName: string
  className?: string
}) {
  const played = matches.length
  if (played < 1) return null

  const balls = Math.min(played, MAX_BALLS)
  const label = `${played} ${played === 1 ? 'partido jugado' : 'partidos jugados'} este mes`

  return (
    <Dialog>
      {/* Hover → tooltip (desktop); click → Dialog. Un solo botón con ambos
          comportamientos: TooltipTrigger renderiza el DialogTrigger (merge de props). */}
      <TooltipProvider delay={0}>
        <Tooltip>
          <TooltipTrigger
            render={<DialogTrigger />}
            aria-label={label}
            className={cn(
              // -m-1 p-1 agranda el área de tap sin correr a los vecinos
              'inline-flex shrink-0 -m-1 cursor-pointer items-center gap-0.5 rounded-md p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className
            )}
          >
            {Array.from({ length: balls }).map((_, i) => (
              <TennisBall key={i} className="h-[18px] w-[18px]" />
            ))}
            {played > MAX_BALLS && (
              <span className="text-sm font-semibold tabular-nums text-lime-600 dark:text-lime-500">{played}</span>
            )}
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2 pr-6">
            <TennisBall className="h-5 w-5 shrink-0" />
            <span className="min-w-0 truncate">{playerName}</span>
          </DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>

        <ul className="max-h-[60vh] divide-y overflow-y-auto">
          {matches.map((m) => (
            <li key={m.matchId} className="flex items-center gap-2.5 px-4 py-2.5">
              <Badge
                variant={m.won ? 'success' : 'destructive'}
                className={cn('w-16 shrink-0', !m.won && 'border-destructive/30 dark:border-destructive/40')}
              >
                {m.won ? 'Ganó' : 'Perdió'}
              </Badge>
              <span className="min-w-0 flex-1 truncate">
                <span className="mr-1 text-xs text-muted-foreground">vs</span>
                {m.rivalSlug ? (
                  <Link href={`/jugador/${m.rivalSlug}`} className="font-medium hover:underline">
                    {m.rivalName}
                  </Link>
                ) : (
                  <span className="font-medium">{m.rivalName}</span>
                )}
                {m.rivalRank != null && <span className="ml-1 text-xs text-muted-foreground/70">#{m.rivalRank}</span>}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatDateUY(m.playedAt, 'dd/MM')}
              </span>
              <span className="shrink-0 font-mono text-sm font-bold tabular-nums">{m.score}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
