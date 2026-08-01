'use client'

import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { formatDateUY } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { RivalRecord } from '@/services/ladder-player-stats-service'

/**
 * Rivales frecuentes: head-to-head contra cada rival enfrentado (≥1 cruce),
 * ordenados por cantidad de cruces. Cada fila expande al detalle de los
 * partidos (marcador, fecha, puntos ganados/perdidos). Oculta si no hay.
 */
export function FrequentRivals({ rivals }: { rivals: RivalRecord[] }) {
  if (rivals.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Rivales frecuentes</h2>
      <div className="space-y-2">
        {rivals.map((r) => (
          <Collapsible key={r.rivalUserId} className="rounded-lg border bg-card">
            <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted/50">
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="mr-1 text-xs text-muted-foreground">vs</span>
                <span className="font-medium">{r.rivalName}</span>
                {r.rivalRank != null && <span className="ml-1 text-xs text-muted-foreground/70">#{r.rivalRank}</span>}
              </span>
              <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                {r.wins}-{r.losses}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="divide-y border-t">
                {r.matches.map((m) => (
                  <li key={m.matchId} className="flex items-center gap-2.5 px-4 py-2.5">
                    <Badge
                      variant={m.won ? 'success' : 'destructive'}
                      className={cn('w-16 shrink-0', !m.won && 'border-destructive/30 dark:border-destructive/40')}
                    >
                      {m.won ? 'Ganó' : 'Perdió'}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-xs tabular-nums text-muted-foreground">
                      {formatDateUY(m.date, 'dd/MM/yy')}
                    </span>
                    {m.delta != null && m.delta !== 0 && (
                      <span
                        className={cn(
                          'shrink-0 text-xs font-semibold tabular-nums',
                          m.delta > 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
                        )}
                      >
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums">{m.score}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </section>
  )
}
