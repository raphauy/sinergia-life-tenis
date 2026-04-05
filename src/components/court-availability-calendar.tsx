'use client'

import { useState, useMemo, useTransition, useCallback } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { CalendarDayButton } from '@/components/ui/calendar'
import { DailyScheduleView } from './daily-schedule-view'
import { fetchMonthMatchesAction } from '@/app/jugador/[slug]/partidos/[matchId]/actions'
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

interface Props {
  initialMatches: CalendarMatch[]
  tournamentId: string
  initialYear: number
  initialMonth: number // 1-based
}

export function CourtAvailabilityCalendar({
  initialMatches,
  tournamentId,
  initialYear,
  initialMonth,
}: Props) {
  const initialKey = `${initialYear}-${initialMonth.toString().padStart(2, '0')}`
  const [matchesByMonth, setMatchesByMonth] = useState<Map<string, CalendarMatch[]>>(
    () => new Map([[initialKey, initialMatches]])
  )
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(initialYear, initialMonth - 1, 1)
  )
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [isPending, startTransition] = useTransition()

  const currentKey = `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}`
  const currentMatches = matchesByMonth.get(currentKey) || []

  // Count matches per day for badge display
  const matchCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of currentMatches) {
      counts[m.dateUY] = (counts[m.dateUY] || 0) + 1
    }
    return counts
  }, [currentMatches])

  const handleMonthChange = useCallback((month: Date) => {
    setCurrentMonth(month)
    setSelectedDay(null)
    const y = month.getFullYear()
    const m = month.getMonth() + 1
    const key = `${y}-${m.toString().padStart(2, '0')}`
    if (!matchesByMonth.has(key)) {
      startTransition(async () => {
        const matches = await fetchMonthMatchesAction(tournamentId, y, m)
        setMatchesByMonth((prev) => new Map(prev).set(key, matches))
      })
    }
  }, [tournamentId, matchesByMonth])

  const handleDayClick = useCallback((day: Date) => {
    setSelectedDay((prev) =>
      prev && prev.toDateString() === day.toDateString() ? null : day
    )
  }, [])

  // Matches for selected day
  const dayMatches = useMemo(() => {
    if (!selectedDay) return []
    const dayKey = `${selectedDay.getFullYear()}-${(selectedDay.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.getDate().toString().padStart(2, '0')}`
    return currentMatches.filter((m) => m.dateUY === dayKey)
  }, [selectedDay, currentMatches])

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

      {selectedDay && (
        <DailyScheduleView matches={dayMatches} day={selectedDay} />
      )}
    </div>
  )
}
