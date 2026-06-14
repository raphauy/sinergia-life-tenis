import { cn } from '@/lib/utils'
import type { RatingPoint } from '@/services/ladder-stats-service'

/**
 * Curva de evolución de Rating (SVG liviano, sin librería de charts). Mobile-first:
 * ancho 100%, alto fijo. No renderiza con menos de 2 puntos. `framed` (default true)
 * envuelve en una card con borde; en false va sin borde (p. ej. dentro de un Dialog,
 * que ya aporta el contenedor).
 */
export function RatingEvolutionChart({ points, framed = true }: { points: RatingPoint[]; framed?: boolean }) {
  if (points.length < 2) return null

  const W = 320
  const H = 96
  const P = 10
  const ratings = points.map((p) => p.rating)
  const min = Math.min(...ratings)
  const max = Math.max(...ratings)
  const span = max - min || 1
  const n = points.length
  const x = (i: number) => P + (i / (n - 1)) * (W - 2 * P)
  const y = (r: number) => P + (1 - (r - min) / span) * (H - 2 * P)

  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join(' ')
  const area = `${P.toFixed(1)},${(H - P).toFixed(1)} ${line} ${(W - P).toFixed(1)},${(H - P).toFixed(1)}`

  const current = ratings[n - 1]
  const first = ratings[0]
  const diff = current - first

  return (
    <div className={cn(framed && 'rounded-lg border p-4')}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Evolución de puntos</span>
        <span className="text-sm">
          <span className="font-bold tabular-nums">{current}</span>{' '}
          <span
            className={cn(
              'text-xs tabular-nums',
              diff >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
            )}
          >
            {diff >= 0 ? '+' : ''}
            {diff}
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Evolución de puntos en el tiempo"
      >
        <polyline points={area} className="fill-primary/10" stroke="none" />
        <polyline
          points={line}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={x(n - 1)} cy={y(current)} r={3.5} className="fill-primary" />
      </svg>
    </div>
  )
}
