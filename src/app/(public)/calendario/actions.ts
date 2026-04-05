'use server'

import { getMonthMatches } from '@/services/match-service'
import { fullName } from '@/lib/format-name'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import type { CalendarMatch } from '@/components/court-availability-calendar'

export async function fetchMonthMatchesPublicAction(
  tournamentId: string,
  year: number,
  month: number
): Promise<CalendarMatch[]> {
  const matches = await getMonthMatches(tournamentId, year, month)
  return matches.map((m) => ({
    scheduledAt: m.scheduledAt!.toISOString(),
    timeUY: formatTimeUY(m.scheduledAt!),
    dateUY: formatDateUY(m.scheduledAt!, 'yyyy-MM-dd'),
    courtNumber: m.courtNumber,
    player1Name: fullName(m.player1.firstName, m.player1.lastName),
    player2Name: fullName(m.player2.firstName, m.player2.lastName),
    categoryName: m.category.name,
    groupNumber: m.group?.number ?? null,
  }))
}
