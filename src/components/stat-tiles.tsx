import type { MemberLadderStats } from '@/services/ladder-player-stats-service'

/** "3,5" con coma decimal; sin decimales si es entero. */
function formatPerMonth(n: number): string {
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-lg border bg-card px-2 py-3">
      <span className="text-xl font-bold tabular-nums leading-none">{value}</span>
      <span className="text-center text-[11px] leading-tight text-muted-foreground">{label}</span>
    </div>
  )
}

/**
 * Fila de tiles de la tab Estadísticas (número grande + label chico, estilo
 * Tenis Tracker): W-L, win rate, pico de puntos, mejor puesto, racha récord y
 * frecuencia de partidos. Mobile-first: 3 columnas → 6 en desktop.
 */
export function StatTiles({ stats, bestPosition }: { stats: MemberLadderStats; bestPosition: number | null }) {
  const frequency =
    stats.frequency.kind === 'average'
      ? { value: formatPerMonth(stats.frequency.perMonth), label: 'Partidos /mes' }
      : { value: String(stats.frequency.total), label: 'Este mes' }

  return (
    <div className="mb-8 grid grid-cols-3 gap-2 sm:grid-cols-6">
      <Tile value={`${stats.wins}-${stats.losses}`} label="Ganados-Perdidos" />
      <Tile value={stats.winRate != null ? `${stats.winRate}%` : '—'} label="Efectividad" />
      <Tile value={stats.peakRating != null ? String(stats.peakRating) : '—'} label="Pico de puntos" />
      <Tile value={bestPosition != null ? `#${bestPosition}` : '—'} label="Mejor puesto" />
      <Tile value={String(stats.longestStreak)} label="Racha récord" />
      <Tile value={frequency.value} label={frequency.label} />
    </div>
  )
}
