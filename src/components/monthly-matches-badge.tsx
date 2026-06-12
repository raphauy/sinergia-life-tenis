import { IconTooltip } from '@/components/icon-tooltip'
import { cn } from '@/lib/utils'

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
 * criterio que los fueguitos). Tooltip clickeable (apto mobile). No renderiza nada
 * si jugó 0. La cuenta sale de getLadderMonthlyMatchesPlayed (mismo criterio que el
 * cierre mensual): de un vistazo, cuántos partidos lleva el jugador en el mes.
 */
export function MonthlyMatchesBadge({ played, className }: { played: number; className?: string }) {
  if (played < 1) return null

  const balls = Math.min(played, MAX_BALLS)
  const label = `${played} ${played === 1 ? 'partido jugado' : 'partidos jugados'} este mes`

  return (
    <IconTooltip label={label} className={cn('gap-0.5', className)}>
      {Array.from({ length: balls }).map((_, i) => (
        <TennisBall key={i} className="h-[18px] w-[18px]" />
      ))}
      {played > MAX_BALLS && (
        <span className="text-sm font-semibold tabular-nums text-lime-600 dark:text-lime-500">{played}</span>
      )}
    </IconTooltip>
  )
}
