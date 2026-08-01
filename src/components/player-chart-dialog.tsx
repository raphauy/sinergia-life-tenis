"use client"

import { useState, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { RatingEvolutionChart } from '@/components/rating-evolution-chart'
import { getRatingEvolutionAction } from '@/app/jugador/[slug]/escalera-actions'
import { cn } from '@/lib/utils'
import type { RatingPoint } from '@/services/ladder-stats-service'

/**
 * Dialog con la gráfica de evolución de puntos de un jugador (la misma que el perfil).
 * El trigger (children) son los puntos de la fila del ranking, clickeables/tapeables.
 * Sin borde adentro (framed=false): el Dialog ya es el contenedor.
 *
 * La curva se carga LAZY al abrir por primera vez (server action) — así la home no
 * embebe el historial de todos los miembros en su payload — y queda cacheada para
 * reaperturas.
 */
export function PlayerChartDialog({
  playerName,
  userId,
  className,
  children,
}: {
  playerName: string
  userId: string
  className?: string
  children: ReactNode
}) {
  const [points, setPoints] = useState<RatingPoint[] | null>(null)

  function handleOpenChange(open: boolean) {
    if (open && points === null) {
      // El catch cubre fallas de red (la action ya devuelve [] ante errores propios):
      // sin él, el Skeleton quedaría para siempre. Cae al estado "sin historial".
      getRatingEvolutionAction(userId)
        .then(setPoints)
        .catch(() => setPoints([]))
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange}>
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
        {points === null ? (
          <Skeleton className="h-[120px] w-full" />
        ) : points.length >= 2 ? (
          <RatingEvolutionChart points={points} framed={false} />
        ) : (
          <p className="text-sm text-muted-foreground">Todavía no hay historial suficiente para la gráfica.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
