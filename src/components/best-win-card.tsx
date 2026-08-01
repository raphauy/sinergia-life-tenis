import Link from 'next/link'
import { Medal } from 'lucide-react'
import { formatDateUY } from '@/lib/date-utils'
import type { BestWin } from '@/services/ladder-player-stats-service'

/**
 * Mejor victoria: la victoria (no W/O) contra el rival mejor rankeado al
 * momento de jugar (del replay histórico de puestos): "vs Fulano que era #3".
 * Oculta si no hay.
 */
export function BestWinCard({ win }: { win: BestWin | null }) {
  if (!win) return null

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Mejor victoria</h2>
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3.5">
        <Medal className="h-6 w-6 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="mr-1 text-xs text-muted-foreground">vs</span>
            {win.rivalSlug ? (
              <Link href={`/jugador/${win.rivalSlug}`} className="font-medium hover:underline">
                {win.rivalName}
              </Link>
            ) : (
              <span className="font-medium">{win.rivalName}</span>
            )}
            <span className="ml-1 text-muted-foreground">
              que era <span className="font-semibold tabular-nums text-foreground">#{win.rivalPositionAtTime}</span>
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{formatDateUY(win.date)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="font-mono text-sm font-bold tabular-nums">{win.score}</span>
          {win.delta != null && (
            <span className="text-xs font-semibold tabular-nums text-green-600 dark:text-green-500">+{win.delta}</span>
          )}
        </div>
      </div>
    </section>
  )
}
