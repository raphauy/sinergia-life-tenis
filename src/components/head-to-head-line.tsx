'use client'

import Link from 'next/link'
import { ChevronRight, Swords } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatDateUY } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { HeadToHead } from '@/services/head-to-head-service'

/**
 * Nombre corto para los textos compactos: primer nombre, o primer nombre + inicial
 * del apellido si el rival comparte el primer nombre (para que no se confundan).
 */
function shortName(name: string, otherName: string): string {
  const [first, ...rest] = name.split(' ')
  if (!first) return name
  const otherFirst = otherName.split(' ')[0]
  if (first.toLowerCase() !== otherFirst?.toLowerCase()) return first
  const lastInitial = rest.at(-1)?.[0]
  return lastInitial ? `${first} ${lastInitial}.` : first
}

/**
 * Línea de historial (head-to-head) al pie de la card de partido: "4 enfrentamientos ·
 * 4-0 Raphael". Tap → Dialog con todos los cruces entre esos dos jugadores, del más
 * reciente al más viejo: cada fila lleva el nombre del ganador en verde y el marcador
 * a su favor, así se entiende sin leer el encabezado. No se renderiza sin historial.
 *
 * La card entera es clickeable (navega al partido): el trigger corta la propagación
 * del click y del Enter para que abra el Dialog en vez de navegar.
 */
export function HeadToHeadLine({
  h2h,
  player1,
  player2,
  className,
}: {
  h2h: HeadToHead
  player1: { name: string; slug?: string }
  player2: { name: string; slug?: string }
  className?: string
}) {
  if (h2h.total === 0) return null

  const { player1Wins: w1, player2Wins: w2, total } = h2h
  const tied = w1 === w2
  const p1Short = shortName(player1.name, player2.name)
  const p2Short = shortName(player2.name, player1.name)
  const leaderName = w1 >= w2 ? p1Short : p2Short
  const record = tied ? `${w1}-${w2}` : `${Math.max(w1, w2)}-${Math.min(w1, w2)}`
  const countLabel = `${total} ${total === 1 ? 'enfrentamiento' : 'enfrentamientos'}`
  const summary = tied ? `${countLabel} · ${record}` : `${countLabel} · ${record} ${leaderName}`

  return (
    <Dialog>
      <div className={cn('mt-2 flex justify-center border-t border-border/50 pt-2', className)}>
        <DialogTrigger
          aria-label={`Historial entre ${player1.name} y ${player2.name}: ${summary}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Swords className="h-3.5 w-3.5 shrink-0" />
          <span>
            {countLabel} · <span className="font-semibold tabular-nums text-foreground">{record}</span>
            {!tied && <span className="ml-1">{leaderName}</span>}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        </DialogTrigger>
      </div>

      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2 pr-6">
            <Swords className="h-4 w-4 shrink-0 text-muted-foreground" />
            Historial
          </DialogTitle>
          <DialogDescription>{countLabel}</DialogDescription>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
            <span className="min-w-0 truncate text-right">
              {player1.slug ? (
                <Link
                  href={`/jugador/${player1.slug}`}
                  className={cn('hover:underline', w1 > w2 ? 'font-bold' : 'font-medium')}
                >
                  {player1.name}
                </Link>
              ) : (
                <span className={w1 > w2 ? 'font-bold' : 'font-medium'}>{player1.name}</span>
              )}
            </span>
            <span className="shrink-0 font-mono text-base tabular-nums">
              <span className={w1 > w2 ? 'font-bold text-green-600 dark:text-green-500' : 'text-muted-foreground'}>
                {w1}
              </span>
              <span className="mx-1 text-muted-foreground/50">-</span>
              <span className={w2 > w1 ? 'font-bold text-green-600 dark:text-green-500' : 'text-muted-foreground'}>
                {w2}
              </span>
            </span>
            <span className="min-w-0 truncate">
              {player2.slug ? (
                <Link
                  href={`/jugador/${player2.slug}`}
                  className={cn('hover:underline', w2 > w1 ? 'font-bold' : 'font-medium')}
                >
                  {player2.name}
                </Link>
              ) : (
                <span className={w2 > w1 ? 'font-bold' : 'font-medium'}>{player2.name}</span>
              )}
            </span>
          </div>
        </DialogHeader>

        <ul className="max-h-[60vh] divide-y overflow-y-auto">
          {h2h.matches.map((m) => (
            <li key={m.matchId} className={cn(m.isCurrent && 'bg-muted/40')}>
              <Link
                href={`/partido/${m.matchId}`}
                className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-muted"
              >
                <Badge variant="success" className="max-w-[6.5rem] shrink-0 truncate">
                  {m.wonByPlayer1 ? p1Short : p2Short}
                </Badge>
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums">{m.score}</span>
                <span className="min-w-0 flex-1" />
                {m.disputedPoints != null && m.disputedPoints !== 0 && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">±{m.disputedPoints}</span>
                )}
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDateUY(m.date, 'dd/MM/yy')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
