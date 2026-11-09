'use server'

import { getMonthMatches } from '@/services/match-service'
import { getReservationsByMonth, mapReservationToCalendar } from '@/services/reservation-service'
import { calendarMatchNames } from '@/lib/pair-display'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import type { CalendarMatch, CalendarReservation } from '@/components/court-availability-calendar'

export async function fetchMonthMatchesPublicAction(
  tournamentId: string | undefined,
  year: number,
  month: number
): Promise<CalendarMatch[]> {
  const matches = await getMonthMatches(tournamentId, year, month)
  return matches.map((m) => ({
    scheduledAt: m.scheduledAt!.toISOString(),
    timeUY: formatTimeUY(m.scheduledAt!),
    dateUY: formatDateUY(m.scheduledAt!, 'yyyy-MM-dd'),
    courtNumber: m.courtNumber,
    ...calendarMatchNames(m),
    categoryName: m.category?.name ?? '',
  }))
}

export async function fetchMonthReservationsPublicAction(
  tournamentId: string | undefined,
  year: number,
  month: number
): Promise<CalendarReservation[]> {
  const reservations = await getReservationsByMonth(tournamentId, year, month)
  return reservations.map(mapReservationToCalendar)
}
