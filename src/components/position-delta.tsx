import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Flecha de movimiento de puesto (del mes): ↑N si subió, ↓N si bajó, nada si no
 * cambió o no hay baseline (alta posterior al inicio del mes → value undefined).
 */
export function PositionDelta({ value, className }: { value?: number; className?: string }) {
  if (value == null || value === 0) return null
  const up = value > 0
  return (
    <span
      className={cn(
        'inline-flex items-center text-[11px] font-semibold tabular-nums leading-none',
        up ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500',
        className
      )}
      title={up ? `Subió ${value} puesto(s) este mes` : `Bajó ${Math.abs(value)} puesto(s) este mes`}
    >
      {up ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {Math.abs(value)}
    </span>
  )
}
