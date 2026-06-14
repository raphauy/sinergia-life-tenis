import { ArrowUp, ArrowDown } from 'lucide-react'
import { IconTooltip } from '@/components/icon-tooltip'
import { cn } from '@/lib/utils'

/**
 * Flecha de movimiento de puesto (de la semana en curso): ↑N si subió, ↓N si bajó,
 * nada si no cambió o no hay baseline (alta posterior al inicio de la semana → value
 * undefined). Tooltip (shadcn) apto mobile.
 */
export function PositionDelta({ value, className }: { value?: number; className?: string }) {
  if (value == null || value === 0) return null
  const up = value > 0
  const abs = Math.abs(value)
  const label = `${up ? 'Subió' : 'Bajó'} ${abs} ${abs === 1 ? 'puesto' : 'puestos'} esta semana`
  return (
    <IconTooltip label={label} className={className}>
      <span
        className={cn(
          'inline-flex items-center text-[13px] font-semibold tabular-nums leading-none',
          up ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
        )}
      >
        {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        {abs}
      </span>
    </IconTooltip>
  )
}
