'use server'

import { auth } from '@/lib/auth'
import { getMonthMatches, confirmMatch, getPendingMatches, updateMatchCourt } from '@/services/match-service'
import { getPlayerSlugsByUserIds } from '@/services/player-service'
import { fullName } from '@/lib/format-name'
import { stageLabel } from '@/lib/match-status'
import { formatDateUY, formatTimeUY, parseFromUY, longDateUY, longDateTimeUY } from '@/lib/date-utils'
import { sendMatchConfirmationEmail, sendReservationRejectedEmail, generatePlayerMatchUrl } from '@/services/email-service'
import { rejectReservationSchema, REJECT_REASON_EMAIL_LABELS, type RejectReservationReason } from '@/lib/validations/reservation'
import { COURTS } from '@/lib/constants'
import { revalidatePath } from 'next/cache'
import type { CalendarMatch, CalendarReservation } from '@/components/court-availability-calendar'
import type { ActionResult } from '@/lib/action-types'
import { getReservationsByMonth, getReservationById, releaseReservation, mapReservationToCalendar } from '@/services/reservation-service'

function isAdmin(role?: string) {
  return role === 'SUPERADMIN' || role === 'ADMIN'
}

export async function fetchMonthMatchesAdminAction(
  _tournamentId: string | undefined,
  year: number,
  month: number
): Promise<CalendarMatch[]> {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) return []

  // Ocupación global de canchas: el admin gestiona torneo + escalera (canchas compartidas).
  const matches = await getMonthMatches(undefined, year, month)
  return matches.map((m) => ({
    id: m.id,
    scheduledAt: m.scheduledAt!.toISOString(),
    timeUY: formatTimeUY(m.scheduledAt!),
    dateUY: formatDateUY(m.scheduledAt!, 'yyyy-MM-dd'),
    courtNumber: m.courtNumber,
    player1Name: fullName(m.player1?.firstName, m.player1?.lastName),
    player2Name: fullName(m.player2?.firstName, m.player2?.lastName),
    categoryName: m.category?.name ?? '',
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
        const p1 = fullName(m.player1?.firstName, m.player1?.lastName).toLowerCase()
        const p2 = fullName(m.player2?.firstName, m.player2?.lastName).toLowerCase()
        return p1.includes(q) || p2.includes(q)
      })
    : matches

  return filtered.slice(0, 10).map((m) => ({
    id: m.id,
    player1Name: fullName(m.player1?.firstName, m.player1?.lastName),
    player2Name: fullName(m.player2?.firstName, m.player2?.lastName),
    categoryName: m.category?.name ?? '',
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
    // confirmMatch consume la reserva del partido si la hubiera (ver match-service).
    const match = await confirmMatch(matchId, { scheduledAt, courtNumber })

    const court = COURTS.find((c) => c.number === match.courtNumber)
    const dateStr = formatDateUY(match.scheduledAt!)
    const timeStr = formatTimeUY(match.scheduledAt!)

    const label = stageLabel(match.stage)
    const emailPromises = []
    if (match.player1?.email) {
      emailPromises.push(sendMatchConfirmationEmail({
        to: match.player1.email,
        playerName: fullName(match.player1.firstName, match.player1.lastName) || 'Jugador',
        rivalName: fullName(match.player2?.firstName, match.player2?.lastName) || 'Rival',
        tournamentName: match.ladderId ? 'La Escalera' : match.tournament?.name ?? '',
        date: dateStr,
        time: timeStr,
        courtName: court?.name || `Cancha ${match.courtNumber}`,
        stageLabel: label,
      }))
    }
    if (match.player2?.email) {
      emailPromises.push(sendMatchConfirmationEmail({
        to: match.player2.email,
        playerName: fullName(match.player2.firstName, match.player2.lastName) || 'Jugador',
        rivalName: fullName(match.player1?.firstName, match.player1?.lastName) || 'Rival',
        tournamentName: match.ladderId ? 'La Escalera' : match.tournament?.name ?? '',
        date: dateStr,
        time: timeStr,
        courtName: court?.name || `Cancha ${match.courtNumber}`,
        stageLabel: label,
      }))
    }
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

export async function changeCourtFromCalendarAction(
  matchId: string,
  courtNumber: number
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user.role)) {
      return { success: false, error: 'No autorizado' }
    }

    await updateMatchCourt(matchId, courtNumber)

    revalidatePath('/admin')
    revalidatePath('/admin/partidos')
    revalidatePath(`/admin/partidos/${matchId}`)
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al cambiar cancha'
    return { success: false, error: msg }
  }
}

export async function fetchMonthReservationsAdminAction(
  _tournamentId: string | undefined,
  year: number,
  month: number
): Promise<CalendarReservation[]> {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) return []

  // Reservas globales: incluye las de partidos de escalera (sin torneo).
  const reservations = await getReservationsByMonth(undefined, year, month)
  return reservations.map(mapReservationToCalendar)
}

export async function confirmReservationAction(
  reservationId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user.role)) {
      return { success: false, error: 'No autorizado' }
    }

    const reservation = await getReservationById(reservationId)
    if (!reservation) return { success: false, error: 'Reserva no encontrada' }

    // El borrado de la reserva va dentro de confirmMatch, en la misma transacción.
    const match = await confirmMatch(reservation.matchId, {
      scheduledAt: reservation.scheduledAt,
      courtNumber: reservation.courtNumber,
    })

    // Send emails
    const court = COURTS.find((c) => c.number === match.courtNumber)
    const dateStr = formatDateUY(match.scheduledAt!)
    const timeStr = formatTimeUY(match.scheduledAt!)

    const confirmLabel = stageLabel(match.stage)
    const confirmEmails = []
    if (match.player1?.email) {
      confirmEmails.push(sendMatchConfirmationEmail({
        to: match.player1.email,
        playerName: fullName(match.player1.firstName, match.player1.lastName) || 'Jugador',
        rivalName: fullName(match.player2?.firstName, match.player2?.lastName) || 'Rival',
        tournamentName: match.ladderId ? 'La Escalera' : match.tournament?.name ?? '',
        date: dateStr,
        time: timeStr,
        courtName: court?.name || `Cancha ${match.courtNumber}`,
        stageLabel: confirmLabel,
      }))
    }
    if (match.player2?.email) {
      confirmEmails.push(sendMatchConfirmationEmail({
        to: match.player2.email,
        playerName: fullName(match.player2.firstName, match.player2.lastName) || 'Jugador',
        rivalName: fullName(match.player1?.firstName, match.player1?.lastName) || 'Rival',
        tournamentName: match.ladderId ? 'La Escalera' : match.tournament?.name ?? '',
        date: dateStr,
        time: timeStr,
        courtName: court?.name || `Cancha ${match.courtNumber}`,
        stageLabel: confirmLabel,
      }))
    }
    await Promise.allSettled(confirmEmails)

    revalidatePath('/admin')
    revalidatePath('/admin/partidos')
    revalidatePath('/jugador')
    revalidatePath('/calendario')
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al confirmar reserva'
    return { success: false, error: msg }
  }
}

/**
 * Rechaza el turno pedido por los jugadores. Además de liberar el slot:
 * — renueva el plazo del partido de escalera (quedarse sin reserva por decisión del
 *   admin no puede acercarlos al vencimiento; antes el reloj seguía corriendo desde
 *   que aceptaron el reto y el cron los mataba esa misma madrugada), y
 * — les avisa por email con el motivo (antes el rechazo era mudo).
 */
export async function rejectReservationAction(
  reservationId: string,
  reason: RejectReservationReason
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user.role)) {
      return { success: false, error: 'No autorizado' }
    }

    const parsed = rejectReservationSchema.safeParse({ reservationId, reason })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }
    }

    const reservation = await getReservationById(reservationId)
    if (!reservation) return { success: false, error: 'Reserva no encontrada' }

    const match = reservation.match

    // Atómico: liberar el turno sin renovar dejaría el partido corriendo con el reloj
    // viejo. Devuelve null en torneo, que no tiene plazo (y ahí el email va sin fecha).
    const newDeadline = await releaseReservation(reservationId, match.id)

    // Aviso a los dos jugadores (fire-and-forget: el rechazo ya se hizo).
    try {
      const deadlineLabel = newDeadline ? longDateUY(newDeadline) : null
      const slotLabel = longDateTimeUY(reservation.scheduledAt)
      const reasonLabel = REJECT_REASON_EMAIL_LABELS[parsed.data.reason]
      const slugMap = await getPlayerSlugsByUserIds(
        [match.player1Id, match.player2Id].filter((id): id is string => !!id)
      )
      const p1Name = fullName(match.player1?.firstName, match.player1?.lastName) || 'Jugador'
      const p2Name = fullName(match.player2?.firstName, match.player2?.lastName) || 'Jugador'

      await Promise.allSettled(
        [
          { email: match.player1?.email, self: p1Name, rival: p2Name, userId: match.player1Id },
          { email: match.player2?.email, self: p2Name, rival: p1Name, userId: match.player2Id },
        ]
          .filter((p) => p.email)
          .map((p) =>
            sendReservationRejectedEmail({
              to: p.email as string,
              playerName: p.self,
              rivalName: p.rival,
              slotLabel,
              reasonLabel,
              deadlineLabel,
              actionUrl: generatePlayerMatchUrl(p.userId ? slugMap.get(p.userId) ?? null : null, match.id),
            })
          )
      )
    } catch (e) {
      console.error('[RESERVA] aviso de rechazo:', e)
    }

    revalidatePath('/admin')
    revalidatePath('/jugador')
    revalidatePath('/calendario')
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al rechazar reserva'
    return { success: false, error: msg }
  }
}
