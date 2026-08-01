'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatDateUY } from '@/lib/date-utils'
import type { RatingPoint } from '@/services/ladder-stats-service'

/**
 * Curva de evolución de Rating (SVG liviano, sin librería de charts). Mobile-first:
 * ancho 100%, alto fijo. No renderiza con menos de 2 puntos. `framed` (default true)
 * envuelve en una card con borde; en false va sin borde (p. ej. dentro de un Dialog,
 * que ya aporta el contenedor).
 *
 * Interactiva estilo gráfica de acciones: scrub con mouse (hover) o dedo
 * (touch-pan-y deja pasar el scroll vertical) y el header muestra el hito del
 * punto — "Ganó vs Fulano +14", multa, siembra — sin layout shift.
 */
export function RatingEvolutionChart({ points, framed = true }: { points: RatingPoint[]; framed?: boolean }) {
  const [sel, setSel] = useState<number | null>(null)

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

  // Guardia al leer (no solo al setear): si los points se achican entre renders
  // (p. ej. una reversión de cierre borra filas de historial), sel puede quedar
  // fuera de rango.
  const selPoint = sel !== null ? (points[sel] ?? null) : null

  function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const vx = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((vx - P) / (W - 2 * P)) * (n - 1))
    setSel(Math.max(0, Math.min(n - 1, i)))
  }

  return (
    <div className={cn(framed && 'rounded-lg border p-4')}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        {selPoint ? (
          <>
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              <span className="tabular-nums">{formatDateUY(selPoint.at, 'dd/MM/yy')}</span> · {pointLabel(selPoint, sel === 0)}
            </span>
            <span className="shrink-0 text-sm">
              <span className="font-bold tabular-nums">{selPoint.rating}</span>
              {sel !== 0 && selPoint.reason !== 'SEED' && (
                <>
                  {' '}
                  <span
                    className={cn(
                      'text-xs tabular-nums',
                      selPoint.delta > 0 && 'text-green-600 dark:text-green-500',
                      selPoint.delta < 0 && 'text-red-600 dark:text-red-500',
                      selPoint.delta === 0 && 'text-muted-foreground'
                    )}
                  >
                    {selPoint.delta > 0 ? '+' : ''}
                    {selPoint.delta}
                  </span>
                </>
              )}
            </span>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair touch-pan-y"
        preserveAspectRatio="none"
        role="img"
        aria-label="Evolución de puntos en el tiempo"
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={() => setSel(null)}
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
        {sel !== null && selPoint && (
          <line
            x1={x(sel)}
            y1={0}
            x2={x(sel)}
            y2={H}
            className="stroke-muted-foreground/40"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        <circle cx={x(n - 1)} cy={y(current)} r={3.5} className="fill-primary" />
        {sel !== null && selPoint && <circle cx={x(sel)} cy={y(selPoint.rating)} r={3.5} className="fill-primary" />}
      </svg>
    </div>
  )
}

/**
 * Hito legible del punto: qué movió los puntos ahí. El primer punto del historial
 * es siempre el alta del miembro, pero solo la siembra original lleva reason SEED
 * (las altas por registro aprobado quedaron como ADJUSTMENT delta 0), por eso se
 * etiqueta por índice y no solo por reason.
 */
function pointLabel(p: RatingPoint, isFirst: boolean): string {
  if (isFirst) return 'Siembra inicial'
  switch (p.reason) {
    case 'SEED':
      return 'Siembra inicial'
    case 'PENALTY':
      return 'Multa por inactividad'
    case 'ADJUSTMENT':
      return 'Ajuste de admin'
    case 'MATCH': {
      const vs = p.rival ? ` vs ${p.rival}` : ''
      if (p.won === null) return `Partido${vs}`
      const verb = p.won ? 'Ganó' : 'Perdió'
      return p.walkover ? `${verb} por W.O.${vs}` : `${verb}${vs}`
    }
  }
}
