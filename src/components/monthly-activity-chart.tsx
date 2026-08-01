import { cn } from '@/lib/utils'
import type { MonthActivity } from '@/services/ladder-player-stats-service'

/**
 * Actividad mensual: barras de Partidos de escalera jugados por mes calendario
 * UY desde el alta del miembro. La barra del mes en curso va atenuada (todavía
 * no cierra). Se oculta si no jugó nunca.
 */
export function MonthlyActivityChart({ months }: { months: MonthActivity[] }) {
  if (months.length === 0 || months.every((m) => m.played === 0)) return null

  const max = Math.max(...months.map((m) => m.played))
  const multiYear = new Set(months.map((m) => m.year)).size > 1

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Actividad</h2>
      <div className="rounded-lg border p-4">
        {/* Sin role="img": los números y labels son texto real, legible por lectores de pantalla. */}
        <div className="flex items-end gap-2">
          {months.map((m) => (
            <div key={`${m.year}-${m.month}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-xs font-semibold tabular-nums leading-none">{m.played}</span>
              <div className="flex h-20 w-full max-w-10 items-end">
                <div
                  className={cn('w-full rounded-t-sm bg-primary', m.current && 'opacity-40', m.played === 0 && 'h-px bg-muted-foreground/30')}
                  style={m.played > 0 ? { height: `${(m.played / max) * 100}%` } : undefined}
                />
              </div>
              <span className="truncate text-[11px] text-muted-foreground">
                {m.label.slice(0, 3)}
                {multiYear ? ` ${String(m.year).slice(2)}` : ''}
              </span>
            </div>
          ))}
        </div>
        {months.at(-1)?.current && (
          <p className="mt-2 text-right text-[11px] text-muted-foreground">{months.at(-1)!.label.slice(0, 3)}: en curso</p>
        )}
      </div>
    </section>
  )
}
