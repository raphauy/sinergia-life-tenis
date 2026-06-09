import { Badge } from '@/components/ui/badge'
import { formatDateUY } from '@/lib/date-utils'
import type { MonthlyActivity } from '@/services/ladder-service'

/**
 * Estado de actividad mensual del miembro (solo visible al dueño/admin del panel):
 * al día / en riesgo / protegido + nota si el último cierre le aplicó multa. En vivo.
 */
export function LadderMonthlyStatus({ activity }: { activity: MonthlyActivity }) {
  const { played, min, status, lastPenalty, protectedUntil } = activity
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {status === 'protegido' ? (
        <Badge className="border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
          Ranking protegido{protectedUntil ? ` · hasta ${formatDateUY(protectedUntil)}` : ''} · sin multa este mes
        </Badge>
      ) : status === 'al-dia' ? (
        <Badge className="border-green-300 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
          Al día este mes · {played}/{min} partidos
        </Badge>
      ) : (
        <Badge className="border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {played}/{min} partidos este mes
        </Badge>
      )}
      {lastPenalty != null && (
        <span className="text-xs text-red-600 dark:text-red-500">
          El último cierre te descontó {lastPenalty} puntos por inactividad.
        </span>
      )}
    </div>
  )
}
