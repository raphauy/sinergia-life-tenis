import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Flecha de movimiento de puesto (de la semana en curso): ↑N si subió, ↓N si bajó,
 * nada si no cambió o no hay baseline (alta posterior al inicio de la semana → value undefined).
 */
export function PositionDelta({ value, className }: { value?: number; className?: string }) {
  if (value == null || value === 0) return null
  const up = value > 0
  return (
    <span
      className={cn(
        'inline-flex items-center text-[13px] font-semibold tabular-nums leading-none',
        up ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500',
        className
      )}
      title={up ? `Subió ${value} puesto(s) esta semana` : `Bajó ${Math.abs(value)} puesto(s) esta semana`}
    >
      {up ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      {Math.abs(value)}
    </span>
  )
}
