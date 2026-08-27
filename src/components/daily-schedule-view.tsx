'use client'

import { useEffect, useRef } from 'react'
import {
  CLASS_SCHEDULE,
  getSlotsForDay,
  getMinReservationDate,
  getMaxReservationDate,
  isLadderReservableDay,
  getLadderDaysForWeek,
  formatLadderDays,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { CalendarMatch, CalendarReservation, LadderReservationInfo } from './court-availability-calendar'
import { slotContextLabel, ScheduleLegend } from './court-availability-calendar'

interface Props {
  matches: CalendarMatch[]
  reservations?: CalendarReservation[]
  day: Date
  /** Días de reserva de La Escalera. null = no se señaliza (torneo). */
  ladderReservation?: LadderReservationInfo | null
}

/**
 * Por qué este día no admite reserva anticipada de La Escalera, o null si la
 * admite. El calendario público no reserva nada: explica, porque un día sin
 * partidos se ve libre y no siempre se puede pedir.
 */
function ladderReservationNote(day: Date, info: LadderReservationInfo): string | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Un día pasado no se reserva por definición, y el domingo el club está cerrado:
  // en ninguno de los dos el motivo es la regla de La Escalera. (El domingo importa
  // en dev, donde la grilla horaria sí se muestra.)
  if (day < today || day.getDay() === 0) return null

  if (!isLadderReservableDay(day)) {
    return `La Escalera no reserva con anticipación este día. Esa semana se puede pedir: ${formatLadderDays(getLadderDaysForWeek(day))}. Si conseguís cancha por tu cuenta, podés jugar igual.`
  }
  if (day < getMinReservationDate(now)) {
    return 'Ya pasó el plazo para pedir reserva anticipada para este día: hay que pedirla con al menos un día hábil de anticipación.'
  }
  if (day > getMaxReservationDate(now, info.leadDays)) {
    return `Todavía no se puede reservar este día: la reserva anticipada se abre ${info.leadDays} días antes.`
  }
  return null
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

export function DailyScheduleView({ matches, reservations = [], day, ladderReservation = null }: Props) {
  const firstOccupiedRef = useRef<HTMLDivElement>(null)
  const byTime = groupByTime(matches)
  const reservationsByTime = groupByTime(reservations)
  const dayOfWeek = day.getDay()
  const slots = getSlotsForDay(dayOfWeek)
  const ladderNote = ladderReservation ? ladderReservationNote(day, ladderReservation) : null
  // "libre" sigue queriendo decir "la cancha está libre", no "podés pedirla": un
  // día que La Escalera no reserva igual se puede jugar consiguiendo cancha por
  // tu cuenta. De por qué no se puede reservar se encarga la nota de arriba.
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
      {slots.length > 0 && ladderNote && (
        <p className="mb-2 text-xs text-muted-foreground text-balance">{ladderNote}</p>
      )}

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
                // Ocupado es ocupado: no se distingue 1 de 2 (el rojo del calendario
                // cuenta los partidos de todo el día, que es otra cosa).
                !isClass && occupied > 0 && 'py-2 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
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
                        Cancha {m.courtNumber ?? '?'} | {slotContextLabel(m)}
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
                        {' '}| {slotContextLabel(r)}
                      </span>
                      <br />
                      <span className="font-medium">
                        {r.player1Name} vs {r.player2Name}
                      </span>
                    </div>
                  ))}
                  {total >= 2 && (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Las dos canchas ocupadas
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}

      {slots.length > 0 && <ScheduleLegend />}
    </div>
  )
}
