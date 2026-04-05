'use client'

import { useEffect, useRef } from 'react'
import { CLASS_SCHEDULE, getSlotsForDay } from '@/lib/constants'
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

function hasClass(dayOfWeek: number, slot: string) {
  return CLASS_SCHEDULE[dayOfWeek]?.includes(slot) ?? false
}

export function DailyScheduleView({ matches, day }: Props) {
  const firstOccupiedRef = useRef<HTMLDivElement>(null)
  const byTime = groupByTime(matches)
  const dayOfWeek = day.getDay()
  const slots = getSlotsForDay(dayOfWeek)

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
          const occupied = slotMatches.length
          const isClass = hasClass(dayOfWeek, slot)
          const isFirst = (occupied > 0 || isClass) && !foundFirst
          if (isFirst) foundFirst = true

          return (
            <div
              key={slot}
              ref={isFirst ? firstOccupiedRef : undefined}
              className={cn(
                'flex items-start gap-2 px-3 border-l-3',
                !isClass && occupied === 0 && 'py-1.5 border-l-muted-foreground/20',
                !isClass && occupied === 1 && 'py-2 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
                !isClass && occupied >= 2 && 'py-2 border-l-red-400 bg-red-50/50 dark:bg-red-950/20',
                isClass && 'py-1.5 border-l-violet-400 bg-violet-50/50 dark:bg-violet-950/20',
              )}
            >
              <span className={cn(
                'text-xs font-mono w-11 shrink-0 pt-0.5',
                !isClass && occupied === 0 ? 'text-muted-foreground/50' : 'text-foreground font-medium',
              )}>
                {slot}
              </span>
              {isClass ? (
                <span className="text-xs text-violet-600 dark:text-violet-400">Reservado para clase grupal</span>
              ) : occupied === 0 ? (
                <span className="text-xs text-muted-foreground/40">libre</span>
              ) : (
                <div className="flex-1 min-w-0 space-y-1">
                  {slotMatches.map((m, i) => (
                    <div key={i} className="text-xs leading-tight">
                      <span className="text-muted-foreground">
                        Cancha {m.courtNumber ?? '?'} | Cat {m.categoryName}{m.groupNumber != null ? ` | Grupo ${m.groupNumber}` : ''}
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
      )}
    </div>
  )
}
