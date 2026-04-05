'use client'

import { useEffect, useRef } from 'react'
import { TIME_SLOTS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { CalendarMatch } from './court-availability-calendar'

interface Props {
  matches: CalendarMatch[]
  day: Date
}

function groupByTime(matches: CalendarMatch[]) {
  const map = new Map<string, CalendarMatch[]>()
  for (const m of matches) {
    if (!map.has(m.timeUY)) map.set(m.timeUY, [])
    map.get(m.timeUY)!.push(m)
  }
  return map
}

export function DailyScheduleView({ matches, day }: Props) {
  const firstOccupiedRef = useRef<HTMLDivElement>(null)
  const byTime = groupByTime(matches)

  useEffect(() => {
    firstOccupiedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [day])

  let foundFirst = false

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2 capitalize">
        {day.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })}
      </h3>
      <div className="rounded-lg border overflow-hidden divide-y">
        {TIME_SLOTS.map((slot) => {
          const slotMatches = byTime.get(slot) || []
          const occupied = slotMatches.length
          const isFirst = occupied > 0 && !foundFirst
          if (isFirst) foundFirst = true

          return (
            <div
              key={slot}
              ref={isFirst ? firstOccupiedRef : undefined}
              className={cn(
                'flex items-start gap-2 px-3 border-l-3',
                occupied === 0 && 'py-1.5 border-l-muted-foreground/20',
                occupied === 1 && 'py-2 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
                occupied >= 2 && 'py-2 border-l-red-400 bg-red-50/50 dark:bg-red-950/20',
              )}
            >
              <span className={cn(
                'text-xs font-mono w-11 shrink-0 pt-0.5',
                occupied === 0 ? 'text-muted-foreground/50' : 'text-foreground font-medium',
              )}>
                {slot}
              </span>
              {occupied === 0 ? (
                <span className="text-xs text-muted-foreground/40">libre</span>
              ) : (
                <div className="flex-1 min-w-0 space-y-1">
                  {slotMatches.map((m, i) => (
                    <div key={i} className="text-xs leading-tight">
                      <span className="text-muted-foreground">
                        Cancha {m.courtNumber ?? '?'} | {m.categoryName}{m.groupNumber != null ? ` | Grupo ${m.groupNumber}` : ''}
                      </span>
                      <br />
                      <span className="font-medium">
                        {m.player1Name} vs {m.player2Name}
                      </span>
                    </div>
                  ))}
                  {occupied >= 2 && (
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
      <p className="text-xs text-muted-foreground mt-2 px-1">
        Cancha 1 suele tener clases. Consultá disponibilidad con Mati.
      </p>
    </div>
  )
}
