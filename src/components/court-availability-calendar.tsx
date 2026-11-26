'use client'

import { useState, useMemo, useTransition, useCallback } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { CalendarDayButton } from '@/components/ui/calendar'
import { DailyScheduleView } from './daily-schedule-view'
import { getDayBlock, isLadderReservableDay, TIME_SLOTS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { es } from 'date-fns/locale'
import type { DayButtonProps } from 'react-day-picker'

export type CalendarMatch = {
  id?: string
  scheduledAt: string // ISO string
  timeUY: string // "HH:mm" in UY timezone
  dateUY: string // "yyyy-MM-dd" in UY timezone
  courtNumber: number | null
  player1Name: string
  player2Name: string
  categoryName: string
  groupNumber: number | null
  /** Nombre del grupo para mostrar ("A" en dobles, "2" en singles). Si falta, se usa groupNumber. */
  groupLabel?: string | null
}

export type CalendarReservation = {
  id: string
  matchId: string
  scheduledAt: string
  timeUY: string
  dateUY: string
  courtNumber: number
  player1Name: string
  player2Name: string
  categoryName: string
  groupNumber: number | null
  reservedByName: string
  player1Cedula?: string | null
  player2Cedula?: string | null
}

// tournamentId puede ser undefined → disponibilidad global (escalera).
export type FetchMonthMatches = (tournamentId: string | undefined, year: number, month: number) => Promise<CalendarMatch[]>
export type FetchMonthReservations = (tournamentId: string | undefined, year: number, month: number) => Promise<CalendarReservation[]>

/**
 * Turno del día que contiene una hora: el último turno que empieza a esa hora o antes
 * (un partido de la Copa Summum a las 08:20 va en el turno de 08:00). Si la hora es
 * anterior al primer turno, va al primero.
 */
export function slotForTime(slots: string[], timeUY: string): string {
  let found = slots[0] ?? timeUY
  for (const slot of slots) if (slot <= timeUY) found = slot
  return found
}

/**
 * Turnos que muestra la agenda de un día: los del club más los turnos de la tarde en los
 * que haya algo cargado fuera de su horario (la Copa Summum un sábado de tarde, cuando el
 * club solo da turnos de mañana). Los agregados son solo para ver: no se reservan.
 */
export function slotsWithOffHours(daySlots: string[], items: { timeUY: string }[]): string[] {
  const last = daySlots.at(-1)
  if (!last) return daySlots
  // Hasta una hora después de que empieza el último turno, el partido es de ese turno
  // (un sábado a las 12:40 sigue ocupando el de 12:00, que no puede verse libre).
  const [h, m] = last.split(':').map(Number)
  const lastEnd = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const extra = new Set<string>()
  for (const item of items) {
    if (item.timeUY < lastEnd) continue
    const slot = slotForTime(TIME_SLOTS, item.timeUY)
    if (slot > last) extra.add(slot)
  }
  return extra.size === 0 ? daySlots : [...daySlots, ...TIME_SLOTS.filter((s) => extra.has(s))]
}

/** Agrupa partidos o reservas por el turno que los contiene (ver `slotForTime`). */
export function groupBySlot<T extends { timeUY: string }>(items: T[], slots: string[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const slot = slotForTime(slots, item.timeUY)
    if (!map.has(slot)) map.set(slot, [])
    map.get(slot)!.push(item)
  }
  return map
}

/** Etiqueta de contexto de un slot: "La Escalera" (sin categoría) o "Cat X | Grupo Y" (torneo). */
export function slotContextLabel(item: { categoryName: string; groupNumber: number | null; groupLabel?: string | null }): string {
  if (!item.categoryName) return 'La Escalera'
  const group = item.groupLabel ?? (item.groupNumber != null ? String(item.groupNumber) : null)
  return `Cat ${item.categoryName}${group ? ` | Grupo ${group}` : ''}`
}

/**
 * Señalización de los días de reserva anticipada de La Escalera en un calendario
 * público. Los días habilitados van marcados en la grilla (pero siguen clickeables:
 * el calendario es para ver los partidos, y los días que no se pueden reservar
 * igual tienen partidos que mirar). Los textos de la semana vienen calculados del
 * server, en hora uruguaya.
 */
export interface LadderReservationInfo {
  /** Tope de anticipación (`Ladder.reservationLeadDays`). */
  leadDays: number
  /** "martes, jueves y sábado" — días habilitados de la semana en curso. */
  daysThisWeek: string
  /** Ídem para la semana siguiente. */
  daysNextWeek: string
}

/** Referencia de los colores de cada hora en la grilla del día. */
export function ScheduleLegend() {
  const items = [
    { label: 'Libre', dot: 'bg-muted-foreground/25' },
    { label: 'Ocupado', dot: 'bg-amber-400' },
    { label: 'Reservado', dot: 'bg-blue-400' },
    { label: 'No disponible', dot: 'bg-violet-400' },
  ]
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', i.dot)} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

interface Props {
  initialMatches: CalendarMatch[]
  initialReservations?: CalendarReservation[]
  tournamentId: string | undefined
  initialYear: number
  initialMonth: number // 1-based
  fetchAction: FetchMonthMatches
  fetchReservationsAction?: FetchMonthReservations
  title?: string
  /** Días de reserva de La Escalera. null/ausente = no se señaliza (torneo). */
  ladderReservation?: LadderReservationInfo | null
}

export function CourtAvailabilityCalendar({
  initialMatches,
  initialReservations = [],
  tournamentId,
  initialYear,
  initialMonth,
  fetchAction,
  fetchReservationsAction,
  title = 'Disponibilidad de canchas',
  ladderReservation = null,
}: Props) {
  const initialKey = `${initialYear}-${initialMonth.toString().padStart(2, '0')}`
  const [matchesByMonth, setMatchesByMonth] = useState<Map<string, CalendarMatch[]>>(
    () => new Map([[initialKey, initialMatches]])
  )
  const [reservationsByMonth, setReservationsByMonth] = useState<Map<string, CalendarReservation[]>>(
    () => new Map([[initialKey, initialReservations]])
  )
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(initialYear, initialMonth - 1, 1)
  )
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [isPending, startTransition] = useTransition()

  const currentKey = `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}`
  const currentMatches = matchesByMonth.get(currentKey) || []
  const currentReservations = reservationsByMonth.get(currentKey) || []

  // Count matches + reservations per day for badge display
  const matchCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of currentMatches) {
      counts[m.dateUY] = (counts[m.dateUY] || 0) + 1
    }
    for (const r of currentReservations) {
      counts[r.dateUY] = (counts[r.dateUY] || 0) + 1
    }
    return counts
  }, [currentMatches, currentReservations])

  const loadMonth = useCallback((y: number, m: number) => {
    const key = `${y}-${m.toString().padStart(2, '0')}`
    if (matchesByMonth.has(key)) return
    startTransition(async () => {
      const [matches, reservations] = await Promise.all([
        fetchAction(tournamentId, y, m),
        fetchReservationsAction ? fetchReservationsAction(tournamentId, y, m) : Promise.resolve([]),
      ])
      setMatchesByMonth((prev) => new Map(prev).set(key, matches))
      setReservationsByMonth((prev) => new Map(prev).set(key, reservations))
    })
  }, [tournamentId, matchesByMonth, fetchAction, fetchReservationsAction])

  const handleMonthChange = useCallback((month: Date) => {
    setCurrentMonth(month)
    setSelectedDay(null)
    loadMonth(month.getFullYear(), month.getMonth() + 1)
  }, [loadMonth])

  const handleDayClick = useCallback((day: Date) => {
    // Día "fuera de mes": mover el calendario a ese mes y cargar sus datos, para
    // que la grilla diaria use la disponibilidad de ese día y no la del mes a la vista.
    if (
      day.getFullYear() !== currentMonth.getFullYear() ||
      day.getMonth() !== currentMonth.getMonth()
    ) {
      setCurrentMonth(new Date(day.getFullYear(), day.getMonth(), 1))
      loadMonth(day.getFullYear(), day.getMonth() + 1)
      setSelectedDay(day)
      return
    }
    setSelectedDay((prev) =>
      prev && prev.toDateString() === day.toDateString() ? null : day
    )
  }, [currentMonth, loadMonth])

  // Matches + reservations for selected day
  const dayMatches = useMemo(() => {
    if (!selectedDay) return []
    const dayKey = `${selectedDay.getFullYear()}-${(selectedDay.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.getDate().toString().padStart(2, '0')}`
    return currentMatches.filter((m) => m.dateUY === dayKey)
  }, [selectedDay, currentMatches])

  const dayReservations = useMemo(() => {
    if (!selectedDay) return []
    const dayKey = `${selectedDay.getFullYear()}-${(selectedDay.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.getDate().toString().padStart(2, '0')}`
    return currentReservations.filter((r) => r.dateUY === dayKey)
  }, [selectedDay, currentReservations])

  // Custom DayButton with match count dot
  function CustomDayButton(props: DayButtonProps) {
    const dayDate = props.day.date
    const dayKey = `${dayDate.getFullYear()}-${(dayDate.getMonth() + 1).toString().padStart(2, '0')}-${dayDate.getDate().toString().padStart(2, '0')}`
    const count = matchCounts[dayKey] || 0
    const isSelected = selectedDay && selectedDay.toDateString() === dayDate.toDateString()
    // Marca (no deshabilita) los días en que La Escalera puede pedir cancha con
    // anticipación. Se pinta todo el mes, no solo la ventana reservable de hoy:
    // lo que se quiere leer de un vistazo es el patrón alternado de la semana.
    const isDayBlocked = getDayBlock(dayKey) != null
    const isLadderDay = ladderReservation != null && isLadderReservableDay(dayDate) && !isDayBlocked

    return (
      <CalendarDayButton
        {...props}
        className={cn(
          props.className,
          '!gap-0.5 !min-w-0 w-full',
          isLadderDay && 'bg-emerald-500/15 dark:bg-emerald-400/15',
          isDayBlocked && 'bg-violet-500/15 dark:bg-violet-400/15',
          isSelected && 'bg-primary/15 ring-2 ring-primary',
        )}
      >
        <span className="text-lg leading-none">{dayDate.getDate()}</span>
        {/* Siempre ámbar: ver el comentario en player-calendar. */}
        {count > 0 ? (
          <span className="size-5.5 rounded-full bg-amber-400 text-xs font-bold leading-none text-amber-950 flex items-center justify-center">
            {count}
          </span>
        ) : (
          <span className="size-5.5" />
        )}
      </CalendarDayButton>
    )
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30 px-2 py-3">
      <h2 className="font-semibold mb-2 text-center">{title}</h2>
      <div className={cn(isPending && 'opacity-50')}>
        <Calendar
          mode="single"
          locale={es}
          month={currentMonth}
          onMonthChange={handleMonthChange}
          onDayClick={handleDayClick}
          className="w-full !px-0 !py-1 [&_table]:w-full [&_.rdp-weekdays]:grid [&_.rdp-weekdays]:grid-cols-7 [&_.rdp-week]:grid [&_.rdp-week]:grid-cols-7 [&_.rdp-weekday]:text-center [&_.rdp-day]:text-center"
          classNames={{
            root: 'w-full',
            month: 'w-full',
            today: 'ring-1 ring-foreground/30 rounded-md !bg-transparent',
          }}
          components={{
            DayButton: CustomDayButton,
          }}
        />
      </div>

      {ladderReservation && (
        <div className="mt-1 space-y-0.5 text-center text-xs text-muted-foreground">
          <p className="text-balance">
            <span
              aria-hidden="true"
              className="mr-1.5 inline-block size-2.5 shrink-0 rounded-[3px] bg-emerald-500/40 align-middle dark:bg-emerald-400/40"
            />
            Días de reserva de La Escalera: se alternan cada semana.
          </p>
          <p className="text-balance">
            Esta semana: <span className="font-medium text-foreground">{ladderReservation.daysThisWeek}</span>.
            {' '}La siguiente: <span className="font-medium text-foreground">{ladderReservation.daysNextWeek}</span>.
          </p>
        </div>
      )}

      {selectedDay && (
        <DailyScheduleView
          matches={dayMatches}
          reservations={dayReservations}
          day={selectedDay}
          ladderReservation={ladderReservation}
        />
      )}
    </div>
  )
}
