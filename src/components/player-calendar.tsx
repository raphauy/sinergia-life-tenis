'use client'

import { useState, useMemo, useTransition, useCallback } from 'react'
import { CalendarCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { friendlyDateTimeUY } from '@/lib/date-utils'
import { getMaxReservationDate, getMinReservationDate, getLadderDaysForWeek, getLadderWeekParity, formatLadderDays, isLadderReservableDay } from '@/lib/constants'
import { Calendar } from '@/components/ui/calendar'
import { CalendarDayButton } from '@/components/ui/calendar'
import { PlayerDailySchedule } from './player-daily-schedule'
import { cn } from '@/lib/utils'
import { es } from 'date-fns/locale'
import type { DayButtonProps } from 'react-day-picker'
import { DayBadgeHint } from './court-availability-calendar'
import type { CalendarMatch, CalendarReservation, FetchMonthMatches, FetchMonthReservations } from './court-availability-calendar'

interface Props {
  initialMatches: CalendarMatch[]
  initialReservations: CalendarReservation[]
  tournamentId: string | undefined
  initialYear: number
  initialMonth: number
  matchId: string
  currentReservation: CalendarReservation | null
  reservationLeadDays?: number | null
  isLadder?: boolean // aplica la regla de días alternantes de La Escalera
  fetchAction: FetchMonthMatches
  fetchReservationsAction: FetchMonthReservations
  createReservationAction: (matchId: string, date: string, time: string, cedula?: string) => Promise<{ success: boolean; error?: string }>
  cancelReservationAction: (matchId: string) => Promise<{ success: boolean; error?: string }>
}

export function PlayerCalendar({
  initialMatches,
  initialReservations,
  tournamentId,
  initialYear,
  initialMonth,
  matchId,
  currentReservation: initialCurrentReservation,
  reservationLeadDays,
  isLadder = false,
  fetchAction,
  fetchReservationsAction,
  createReservationAction,
  cancelReservationAction,
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
  const [currentReservation, setCurrentReservation] = useState<CalendarReservation | null>(initialCurrentReservation)
  const [isPending, startTransition] = useTransition()

  const currentKey = `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}`
  const currentMatches = matchesByMonth.get(currentKey) || []
  const currentReservations = reservationsByMonth.get(currentKey) || []
  // ¿Ya cargó la disponibilidad del mes a la vista? Si no, no mostramos la grilla
  // diaria (se vería vacía/“libre” mientras llega el fetch del mes recién abierto).
  const currentMonthLoaded = matchesByMonth.has(currentKey)

  // Tope de anticipación (escalera): los días posteriores quedan deshabilitados
  // (no clickeables). null en torneo → sin tope.
  const maxReservationDate = useMemo(
    () => (reservationLeadDays != null ? getMaxReservationDate(new Date(), reservationLeadDays) : null),
    [reservationLeadDays]
  )

  // Días alternantes (escalera): las dos semanas que el jugador todavía alcanza a
  // reservar. Se cuentan desde la primera fecha reservable, no desde hoy: un sábado,
  // "esta semana" ya serían días pasados (la anticipación mínima salta al martes).
  const ladderWeeks = useMemo(() => {
    if (!isLadder) return null
    const first = getMinReservationDate(new Date())
    const next = new Date(first)
    next.setDate(next.getDate() + 7)
    // first cae como mucho 4 días adelante, así que o es de esta semana o de la próxima.
    const startsThisWeek = getLadderWeekParity(first) === getLadderWeekParity(new Date())
    return {
      firstLabel: startsThisWeek ? 'Esta semana' : 'La semana que viene',
      first: formatLadderDays(getLadderDaysForWeek(first)),
      next: formatLadderDays(getLadderDaysForWeek(next)),
    }
  }, [isLadder])

  const disabledDays = useMemo(() => {
    const matchers = []
    if (maxReservationDate) matchers.push({ after: maxReservationDate })
    if (isLadder) matchers.push((d: Date) => !isLadderReservableDay(d))
    return matchers.length > 0 ? matchers : undefined
  }, [maxReservationDate, isLadder])

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

  const refreshAll = useCallback(() => {
    const y = currentMonth.getFullYear()
    const m = currentMonth.getMonth() + 1
    startTransition(async () => {
      const [matches, reservations] = await Promise.all([
        fetchAction(tournamentId, y, m),
        fetchReservationsAction(tournamentId, y, m),
      ])
      setMatchesByMonth((prev) => new Map(prev).set(currentKey, matches))
      setReservationsByMonth((prev) => new Map(prev).set(currentKey, reservations))
      // Update current reservation from fresh data
      const myReservation = reservations.find((r) => r.matchId === matchId) ?? null
      setCurrentReservation(myReservation)
    })
  }, [currentMonth, currentKey, tournamentId, matchId, fetchAction, fetchReservationsAction])

  const loadMonth = useCallback((y: number, m: number) => {
    const key = `${y}-${m.toString().padStart(2, '0')}`
    if (matchesByMonth.has(key)) return
    startTransition(async () => {
      const [matches, reservations] = await Promise.all([
        fetchAction(tournamentId, y, m),
        fetchReservationsAction(tournamentId, y, m),
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
    // Día "fuera de mes" (de un mes distinto al que está a la vista): hay que
    // mover el calendario a ese mes y cargar sus datos. Si no, la grilla diaria
    // filtra los datos del mes mostrado y un slot ya reservado se ve libre
    // (el server después lo rechaza como "ya ocupado o reservado").
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

  function CustomDayButton(props: DayButtonProps) {
    const dayDate = props.day.date
    const dayKey = `${dayDate.getFullYear()}-${(dayDate.getMonth() + 1).toString().padStart(2, '0')}-${dayDate.getDate().toString().padStart(2, '0')}`
    const count = matchCounts[dayKey] || 0
    const isSelected = selectedDay && selectedDay.toDateString() === dayDate.toDateString()

    return (
      <CalendarDayButton
        {...props}
        className={cn(
          props.className,
          '!gap-0.5 !min-w-0 w-full',
          isSelected && 'bg-primary/15 ring-2 ring-primary',
        )}
      >
        <span className="text-lg leading-none">{dayDate.getDate()}</span>
        {/* Siempre ámbar: el número ya dice cuántos hay. El rojo a partir de 2
            venía de la grilla horaria (2 = las dos canchas), pero acá el techo
            del día son ~28, así que pintaba de rojo días casi vacíos. */}
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
      <h2 className="font-semibold mb-2 text-center">Disponibilidad de canchas</h2>
      <div className={cn(isPending && 'opacity-50')}>
        <Calendar
          mode="single"
          locale={es}
          month={currentMonth}
          onMonthChange={handleMonthChange}
          onDayClick={handleDayClick}
          disabled={disabledDays}
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

      <DayBadgeHint />

      {maxReservationDate && (
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Reservas habilitadas hasta el{' '}
          <span className="font-medium text-foreground">
            {maxReservationDate.toLocaleDateString('es-UY', { day: 'numeric', month: 'long' })}
          </span>
        </p>
      )}

      {ladderWeeks && (
        <div className="mt-1 space-y-0.5 text-center text-xs text-muted-foreground">
          <p className="text-balance">
            {ladderWeeks.firstLabel} La Escalera reserva:{' '}
            <span className="font-medium text-foreground">{ladderWeeks.first}</span>.
          </p>
          <p className="text-balance">
            La siguiente: <span className="font-medium text-foreground">{ladderWeeks.next}</span>.
          </p>
        </div>
      )}

      {/* Reservation banner — always visible */}
      {currentReservation && (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 flex items-start justify-between gap-2">
          <div className="text-xs">
            <p className="font-semibold text-blue-700 dark:text-blue-300">
              <CalendarCheck className="inline h-3.5 w-3.5 mr-1" />
              Tenés una reserva
            </p>
            <p className="text-muted-foreground mt-0.5">
              {friendlyDateTimeUY(new Date(currentReservation.scheduledAt))}
              {' · Cancha '}{currentReservation.courtNumber}
            </p>
            <p className="text-muted-foreground">Pendiente de confirmación del admin</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              startTransition(async () => {
                const result = await cancelReservationAction(matchId)
                if (result.success) {
                  toast.success('Reserva cancelada')
                  refreshAll()
                } else {
                  toast.error(result.error || 'Error al cancelar')
                }
              })
            }}
            disabled={isPending}
            className="shrink-0 text-xs cursor-pointer"
          >
            Cancelar
          </Button>
        </div>
      )}

      {selectedDay && (
        currentMonthLoaded ? (
          <PlayerDailySchedule
            matches={dayMatches}
            reservations={dayReservations}
            day={selectedDay}
            matchId={matchId}
            currentReservation={currentReservation}
            reservationLeadDays={reservationLeadDays}
            createAction={createReservationAction}
            cancelAction={cancelReservationAction}
            onChanged={refreshAll}
          />
        ) : (
          <p className="mt-4 text-sm text-muted-foreground text-center py-4">
            Cargando disponibilidad…
          </p>
        )
      )}
    </div>
  )
}
