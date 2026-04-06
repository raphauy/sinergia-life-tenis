'use client'

import { useState, useMemo, useTransition, useCallback } from 'react'
import { CalendarCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { friendlyDateTimeUY } from '@/lib/date-utils'
import { Calendar } from '@/components/ui/calendar'
import { CalendarDayButton } from '@/components/ui/calendar'
import { PlayerDailySchedule } from './player-daily-schedule'
import { cn } from '@/lib/utils'
import { es } from 'date-fns/locale'
import type { DayButtonProps } from 'react-day-picker'
import type { CalendarMatch, CalendarReservation, FetchMonthMatches, FetchMonthReservations } from './court-availability-calendar'

interface Props {
  initialMatches: CalendarMatch[]
  initialReservations: CalendarReservation[]
  tournamentId: string
  initialYear: number
  initialMonth: number
  matchId: string
  currentReservation: CalendarReservation | null
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

  const handleMonthChange = useCallback((month: Date) => {
    setCurrentMonth(month)
    setSelectedDay(null)
    const y = month.getFullYear()
    const m = month.getMonth() + 1
    const key = `${y}-${m.toString().padStart(2, '0')}`
    if (!matchesByMonth.has(key)) {
      startTransition(async () => {
        const [matches, reservations] = await Promise.all([
          fetchAction(tournamentId, y, m),
          fetchReservationsAction(tournamentId, y, m),
        ])
        setMatchesByMonth((prev) => new Map(prev).set(key, matches))
        setReservationsByMonth((prev) => new Map(prev).set(key, reservations))
      })
    }
  }, [tournamentId, matchesByMonth, fetchAction, fetchReservationsAction])

  const handleDayClick = useCallback((day: Date) => {
    setSelectedDay((prev) =>
      prev && prev.toDateString() === day.toDateString() ? null : day
    )
  }, [])

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
        {count > 0 ? (
          <span className={cn(
            'size-5.5 rounded-full text-xs font-bold leading-none flex items-center justify-center',
            count >= 2
              ? 'bg-red-500 text-white'
              : 'bg-amber-400 text-amber-950',
          )}>
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
        <PlayerDailySchedule
          matches={dayMatches}
          reservations={dayReservations}
          day={selectedDay}
          matchId={matchId}
          currentReservation={currentReservation}
          createAction={createReservationAction}
          cancelAction={cancelReservationAction}
          onChanged={refreshAll}
        />
      )}
    </div>
  )
}
