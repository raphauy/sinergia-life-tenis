'use client'

import { useState, useMemo, useTransition, useCallback } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { CalendarDayButton } from '@/components/ui/calendar'
import { DailyScheduleView } from './daily-schedule-view'
import { cn } from '@/lib/utils'
import { es } from 'date-fns/locale'
import type { DayButtonProps } from 'react-day-picker'

export type CalendarMatch = {
  scheduledAt: string // ISO string
  timeUY: string // "HH:mm" in UY timezone
  dateUY: string // "yyyy-MM-dd" in UY timezone
  courtNumber: number | null
  player1Name: string
  player2Name: string
  categoryName: string
  groupNumber: number | null
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

export type FetchMonthMatches = (tournamentId: string, year: number, month: number) => Promise<CalendarMatch[]>
export type FetchMonthReservations = (tournamentId: string, year: number, month: number) => Promise<CalendarReservation[]>

interface Props {
  initialMatches: CalendarMatch[]
  initialReservations?: CalendarReservation[]
  tournamentId: string
  initialYear: number
  initialMonth: number // 1-based
  fetchAction: FetchMonthMatches
  fetchReservationsAction?: FetchMonthReservations
  title?: string
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
          fetchReservationsAction ? fetchReservationsAction(tournamentId, y, m) : Promise.resolve([]),
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

      {selectedDay && (
        <DailyScheduleView matches={dayMatches} reservations={dayReservations} day={selectedDay} />
      )}
    </div>
  )
}
