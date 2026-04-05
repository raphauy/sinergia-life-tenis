'use server'

import { auth } from '@/lib/auth'
import { getMonthMatches, confirmMatch, getPendingMatches } from '@/services/match-service'
import { fullName } from '@/lib/format-name'
import { formatDateUY, formatTimeUY, parseFromUY } from '@/lib/date-utils'
import { sendMatchConfirmationEmail } from '@/services/email-service'
import { COURTS } from '@/lib/constants'
import { revalidatePath } from 'next/cache'
import type { CalendarMatch } from '@/components/court-availability-calendar'
import type { ActionResult } from '@/lib/action-types'

function isAdmin(role?: string) {
  return role === 'SUPERADMIN' || role === 'ADMIN'
}

export async function fetchMonthMatchesAdminAction(
  tournamentId: string,
  year: number,
  month: number
): Promise<CalendarMatch[]> {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) return []

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

export type PendingMatch = {
  id: string
  player1Name: string
  player2Name: string
  categoryName: string
  groupNumber: number | null
}

export async function searchPendingMatchesAction(
  tournamentId: string,
  query: string
): Promise<PendingMatch[]> {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) return []

  const matches = await getPendingMatches(tournamentId)

  const q = query.toLowerCase().trim()
  const filtered = q
    ? matches.filter((m) => {
        const p1 = fullName(m.player1.firstName, m.player1.lastName).toLowerCase()
        const p2 = fullName(m.player2.firstName, m.player2.lastName).toLowerCase()
        return p1.includes(q) || p2.includes(q)
      })
    : matches

  return filtered.slice(0, 10).map((m) => ({
    id: m.id,
    player1Name: fullName(m.player1.firstName, m.player1.lastName),
    player2Name: fullName(m.player2.firstName, m.player2.lastName),
    categoryName: m.category.name,
    groupNumber: m.group?.number ?? null,
  }))
}

export async function confirmMatchFromCalendarAction(
  matchId: string,
  date: string,
  time: string,
  courtNumber: number
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user.role)) {
      return { success: false, error: 'No autorizado' }
    }

    const scheduledAt = parseFromUY(date, time)
    const match = await confirmMatch(matchId, { scheduledAt, courtNumber })

    const court = COURTS.find((c) => c.number === match.courtNumber)
    const dateStr = formatDateUY(match.scheduledAt!)
    const timeStr = formatTimeUY(match.scheduledAt!)

    const emailPromises = [
      sendMatchConfirmationEmail({
        to: match.player1.email,
        playerName: fullName(match.player1.firstName, match.player1.lastName) || 'Jugador',
        rivalName: fullName(match.player2.firstName, match.player2.lastName) || 'Rival',
        tournamentName: match.tournament.name,
        date: dateStr,
        time: timeStr,
        courtName: court?.name || `Cancha ${match.courtNumber}`,
      }),
      sendMatchConfirmationEmail({
        to: match.player2.email,
        playerName: fullName(match.player2.firstName, match.player2.lastName) || 'Jugador',
        rivalName: fullName(match.player1.firstName, match.player1.lastName) || 'Rival',
        tournamentName: match.tournament.name,
        date: dateStr,
        time: timeStr,
        courtName: court?.name || `Cancha ${match.courtNumber}`,
      }),
    ]
    await Promise.allSettled(emailPromises)

    revalidatePath('/admin')
    revalidatePath('/admin/partidos')
    revalidatePath(`/admin/partidos/${matchId}`)
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al confirmar partido'
    return { success: false, error: msg }
  }
}
