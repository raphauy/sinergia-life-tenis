import { ArrowUp, ArrowDown } from 'lucide-react'
import { IconTooltip } from '@/components/icon-tooltip'
import { cn } from '@/lib/utils'

/**
 * Variación de puntos (Rating) del mes corriente, al lado del puntaje: ↑N en verde si
 * ganó neto en sus partidos del mes, ↓N en rojo si perdió. No dibuja nada si el neto
 * es 0 o no jugó (value 0/undefined). N = puntos netos sumados en los partidos de
 * escalera del mes (ver getMonthlyRatingDeltas). Tooltip (shadcn) apto mobile.
 */
export function RatingMonthDelta({ value, className }: { value?: number; className?: string }) {
  if (value == null || value === 0) return null
  const up = value > 0
  const abs = Math.abs(value)
  const label = `${up ? 'Ganó' : 'Perdió'} ${abs} ${abs === 1 ? 'punto' : 'puntos'} este mes`
  return (
    <IconTooltip label={label} className={className}>
      <span
        className={cn(
          'inline-flex items-center text-xs font-semibold tabular-nums leading-none',
          up ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
        )}
      >
        {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {abs}
      </span>
    </IconTooltip>
  )
}
