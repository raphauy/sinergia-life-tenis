import { Badge } from '@/components/ui/badge'
import type { MonthlyActivity } from '@/services/ladder-service'

/**
 * Estado de actividad mensual del miembro (solo visible al dueño/admin del panel):
 * al día / en riesgo + nota si el último cierre le aplicó multa. Calculado en vivo.
 */
export function LadderMonthlyStatus({ activity }: { activity: MonthlyActivity }) {
  const { played, min, status, lastPenalty } = activity
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {status === 'al-dia' ? (
        <Badge className="border-green-300 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
          Al día este mes · {played}/{min} partidos
        </Badge>
      ) : (
        <Badge className="border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          En riesgo · {played}/{min} partidos este mes
        </Badge>
      )}
      {lastPenalty != null && (
        <span className="text-xs text-red-600 dark:text-red-500">
          El último cierre te descontó {lastPenalty} de ranking por inactividad.
        </span>
      )}
    </div>
  )
}
