"use client"

import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { RatingEvolutionChart } from '@/components/rating-evolution-chart'
import { cn } from '@/lib/utils'
import type { RatingPoint } from '@/services/ladder-stats-service'

/**
 * Dialog con la gráfica de evolución de puntos de un jugador (la misma que el perfil).
 * El trigger (children) son los puntos de la fila del ranking, clickeables/tapeables.
 * Sin borde adentro (framed=false): el Dialog ya es el contenedor.
 */
export function PlayerChartDialog({
  playerName,
  points,
  className,
  children,
}: {
  playerName: string
  points: RatingPoint[]
  className?: string
  children: ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Ver evolución de puntos de ${playerName}`}
        className={cn(
          'cursor-pointer rounded-sm underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
      >
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">{playerName}</DialogTitle>
          <DialogDescription>Sus puntos en La Escalera a lo largo del tiempo.</DialogDescription>
        </DialogHeader>
        <RatingEvolutionChart points={points} framed={false} />
      </DialogContent>
    </Dialog>
  )
}
