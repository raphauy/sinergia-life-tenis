"use client"

import { Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/** Link chico "Modalidad de juego" que abre las reglas del torneo de dobles en un dialog. */
export function DoublesRulesDialog() {
  return (
    <Dialog>
      <DialogTrigger className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Info className="h-3.5 w-3.5" />
        Modalidad de juego
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">Modalidad de juego</DialogTitle>
          <DialogDescription>Cómo se juega el torneo.</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>Round robin (todos contra todos) en 4 grupos de 4 parejas cada uno.</li>
          <li>Los partidos son a 4 games sin ventaja; si van 3-3 se juega un mini tiebreak a 5 puntos.</li>
          <li>
            Los primeros de cada grupo clasifican a las semis de la Copa de Oro y los segundos a las semis de la Copa de
            Plata.
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}
