import { Flame } from 'lucide-react'
import { IconTooltip } from '@/components/icon-tooltip'
import { cn } from '@/lib/utils'

const MAX_FLAMES = 5

/**
 * Fueguitos por racha de victorias consecutivas en La Escalera: un 🔥 por victoria,
 * con tope de 5 íconos + el número de la racha si es mayor. Tooltip clickeable
 * (apto mobile) con la racha. No renderiza nada si la racha es 0.
 */
export function WinStreakBadge({ streak, className }: { streak: number; className?: string }) {
  if (streak < 1) return null

  const flames = Math.min(streak, MAX_FLAMES)
  const label = `Racha de ${streak} ${streak === 1 ? 'victoria' : 'victorias'}`

  return (
    <IconTooltip label={label} className={cn('gap-0.5 text-red-500 dark:text-red-400', className)}>
      {Array.from({ length: flames }).map((_, i) => (
        <Flame key={i} className="h-[18px] w-[18px] fill-red-500/25" />
      ))}
      {streak > MAX_FLAMES && (
        <span className="text-sm font-semibold tabular-nums">{streak}</span>
      )}
    </IconTooltip>
  )
}
