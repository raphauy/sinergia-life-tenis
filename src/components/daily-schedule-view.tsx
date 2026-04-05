'use client'

import { useEffect, useRef } from 'react'
import { CLASS_SCHEDULE, getSlotsForDay, getMinReservationDate } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { CalendarMatch, CalendarReservation } from './court-availability-calendar'

interface Props {
  matches: CalendarMatch[]
  reservations?: CalendarReservation[]
  day: Date
}

function groupByTime<T extends { timeUY: string }>(items: T[]) {
  const map = new Map<string, T[]>()
  for (const item of items) {
    if (!map.has(item.timeUY)) map.set(item.timeUY, [])
    map.get(item.timeUY)!.push(item)
  }
  return map
}

function hasClass(dayOfWeek: number, slot: string) {
  return CLASS_SCHEDULE[dayOfWeek]?.includes(slot) ?? false
}

export function DailyScheduleView({ matches, reservations = [], day }: Props) {
  const firstOccupiedRef = useRef<HTMLDivElement>(null)
  const byTime = groupByTime(matches)
  const reservationsByTime = groupByTime(reservations)
  const dayOfWeek = day.getDay()
  const slots = getSlotsForDay(dayOfWeek)
  const isReservable = day >= getMinReservationDate(new Date())

  useEffect(() => {
    firstOccupiedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [day])

  let foundFirst = false

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2 capitalize">
        {day.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })}
      </h3>
      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Club cerrado</p>
      ) : (
      <div className="rounded-lg border overflow-hidden divide-y">
        {slots.map((slot) => {
          const slotMatches = byTime.get(slot) || []
          const slotReservations = reservationsByTime.get(slot) || []
          const occupied = slotMatches.length
          const reserved = slotReservations.length
          const total = occupied + reserved
          const isClass = hasClass(dayOfWeek, slot)
          const isFirst = (total > 0 || isClass) && !foundFirst
          if (isFirst) foundFirst = true

          return (
            <div
              key={slot}
              ref={isFirst ? firstOccupiedRef : undefined}
              className={cn(
                'flex items-start gap-2 px-3 border-l-3',
                isClass && 'py-1.5 border-l-violet-400 bg-violet-50/50 dark:bg-violet-950/20',
                !isClass && total === 0 && 'py-1.5 border-l-muted-foreground/20',
                !isClass && reserved > 0 && occupied === 0 && 'py-2 border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/20',
                !isClass && occupied > 0 && reserved === 0 && occupied < 2 && 'py-2 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
                !isClass && total >= 2 && 'py-2 border-l-red-400 bg-red-50/50 dark:bg-red-950/20',
              )}
            >
              <span className={cn(
                'text-xs font-mono w-11 shrink-0 pt-0.5',
                !isClass && total === 0 ? 'text-muted-foreground/50' : 'text-foreground font-medium',
              )}>
                {slot}
              </span>
              {isClass ? (
                <span className="text-xs text-violet-600 dark:text-violet-400">Reservado para clase grupal</span>
              ) : total === 0 ? (
                isReservable
                  ? <span className="text-xs text-muted-foreground/40">libre</span>
                  : <span className="text-xs text-muted-foreground/40" />
              ) : (
                <div className="flex-1 min-w-0 space-y-1">
                  {slotMatches.map((m, i) => (
                    <div key={`m-${i}`} className="text-xs leading-tight">
                      <span className="text-muted-foreground">
                        Cancha {m.courtNumber ?? '?'} | Cat {m.categoryName}{m.groupNumber != null ? ` | Grupo ${m.groupNumber}` : ''}
                      </span>
                      <br />
                      <span className="font-medium">
                        {m.player1Name} vs {m.player2Name}
                      </span>
                    </div>
                  ))}
                  {slotReservations.map((r, i) => (
                    <div key={`r-${i}`} className="text-xs leading-tight">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        Reservado
                      </span>
                      <span className="text-muted-foreground">
                        {' '}| Cat {r.categoryName}{r.groupNumber != null ? ` | Grupo ${r.groupNumber}` : ''}
                      </span>
                      <br />
                      <span className="font-medium">
                        {r.player1Name} vs {r.player2Name}
                      </span>
                    </div>
                  ))}
                  {total >= 2 && (
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">
                      Sin canchas disponibles
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
