'use server'

import { auth } from '@/lib/auth'
import { getMatchById, selfScheduleLadderMatch } from '@/services/match-service'
import { createMatchResult, updateMatchResultPhoto } from '@/services/match-result-service'
import { uploadImage, deleteImage } from '@/services/upload-service'
import { notifyMatchResult } from '@/services/match-result-notification'
import { createMatchResultSchema } from '@/lib/validations/match-result'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-types'
import { getMonthMatches } from '@/services/match-service'
import { fullName } from '@/lib/format-name'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import type { CalendarMatch, CalendarReservation } from '@/components/court-availability-calendar'
import { createReservation, getReservationsByMonth, getReservationByMatch, getCalendarReservationByMatch, releaseReservation, mapReservationToCalendar } from '@/services/reservation-service'
import { getUserById, updateUser } from '@/services/user-service'
import { parseFromUY } from '@/lib/date-utils'
import { COURTS, getMinReservationDate, TIMEZONE } from '@/lib/constants'
import { toZonedTime } from 'date-fns-tz'
import { selfScheduleMatchSchema } from '@/lib/validations/match'
import { sendMatchConfirmationEmail } from '@/services/email-service'
import { stageLabel } from '@/lib/match-status'

export async function playerLoadResultAction(
  matchId: string,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }

    const match = await getMatchById(matchId)
    if (!match) return { success: false, error: 'Partido no encontrado' }

    // Auth: user must be player1 or player2
    const isInMatch =
      match.player1Id === session.user.id || match.player2Id === session.user.id
    const isAdmin = session.user.role === 'SUPERADMIN' || session.user.role === 'ADMIN'

    if (!isInMatch && !isAdmin) {
      return { success: false, error: 'No autorizado para este partido' }
    }

    if (match.status !== 'CONFIRMED') {
      return { success: false, error: 'El partido debe estar confirmado' }
    }

    if (match.result) {
      return { success: false, error: 'Este partido ya tiene resultado' }
    }

    if (!match.player1Id || !match.player2Id) {
      return { success: false, error: 'El partido aún no tiene ambos jugadores asignados' }
    }

    const isWalkover = data.walkover === true || data.walkover === 'true'
    const matchFormat = match.ladderId
      ? match.ladder?.matchFormat ?? 'SINGLE_SET'
      : match.tournament?.matchFormat ?? 'SINGLE_SET'
    const schema = createMatchResultSchema(
      matchFormat,
      match.player1Id,
      match.player2Id,
      isWalkover
    )
    const validated = schema.safeParse(data)
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || 'Datos inválidos',
      }
    }

    await createMatchResult({
      matchId,
      reportedById: session.user.id,
      ...validated.data,
      photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : undefined,
    })

    // Notify group players + admins (fire-and-forget)
    const updatedMatch = await getMatchById(matchId)
    if (updatedMatch) {
      notifyMatchResult(updatedMatch)
    }

    revalidatePath(`/jugador`)
    revalidatePath(`/admin/partidos`)
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al cargar resultado'
    return { success: false, error: msg }
  }
}

export async function fetchMonthMatchesAction(
  tournamentId: string | undefined,
  year: number,
  month: number
): Promise<CalendarMatch[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  const matches = await getMonthMatches(tournamentId, year, month)
  return matches.map((m) => ({
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

export async function fetchMonthReservationsAction(
  tournamentId: string | undefined,
  year: number,
  month: number
): Promise<CalendarReservation[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  const reservations = await getReservationsByMonth(tournamentId, year, month)
  return reservations.map(mapReservationToCalendar)
}

/**
 * La reserva del partido, en cualquier mes. El calendario la buscaba dentro de la
 * lista del mes a la vista, así que tras crear/cancelar una reserva de otro mes el
 * banner quedaba desincronizado.
 */
export async function fetchCurrentReservationAction(matchId: string): Promise<CalendarReservation | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const match = await getMatchById(matchId)
  if (!match) return null
  const isInMatch = match.player1Id === session.user.id || match.player2Id === session.user.id
  if (!isInMatch) return null

  return getCalendarReservationByMatch(matchId)
}

export async function createReservationAction(
  matchId: string,
  date: string,
  time: string,
  cedula?: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }

    const match = await getMatchById(matchId)
    if (!match) return { success: false, error: 'Partido no encontrado' }

    const isInMatch = match.player1Id === session.user.id || match.player2Id === session.user.id
    if (!isInMatch) return { success: false, error: 'No autorizado para este partido' }

    // Check/save cédula
    const user = await getUserById(session.user.id)
    if (!user) return { success: false, error: 'Usuario no encontrado' }
    if (!user.cedula && !cedula) {
      return { success: false, error: 'CEDULA_REQUIRED' }
    }
    if (cedula && !user.cedula) {
      await updateUser(session.user.id, { cedula })
    }

    const scheduledAt = parseFromUY(date, time)

    // Validate minimum reservation date
    const nowUY = toZonedTime(new Date(), TIMEZONE)
    const minDate = getMinReservationDate(nowUY)
    const reservationDate = new Date(date)
    if (reservationDate < minDate) {
      return { success: false, error: 'No se puede reservar con tan poca anticipación' }
    }

    await createReservation({
      matchId,
      scheduledAt,
      courtNumber: 2,
      reservedBy: session.user.id,
    })

    revalidatePath('/jugador')
    revalidatePath('/admin')
    revalidatePath('/calendario')
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al reservar'
    return { success: false, error: msg }
  }
}

/**
 * El jugador ya consiguió cancha por su cuenta (app del club o fuera del club) y
 * confirma el partido de escalera sin esperar al admin. No pide cédula: nadie tiene
 * que reservar nada en la app del club.
 */
export async function selfScheduleMatchAction(
  matchId: string,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }

    const validated = selfScheduleMatchSchema.safeParse(data)
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || 'Datos inválidos' }
    }
    const { date, time, location, courtNumber } = validated.data

    const match = await getMatchById(matchId)
    if (!match) return { success: false, error: 'Partido no encontrado' }

    const isInMatch = match.player1Id === session.user.id || match.player2Id === session.user.id
    if (!isInMatch) return { success: false, error: 'No autorizado para este partido' }

    const external = location === 'EXTERNAL'
    const updated = await selfScheduleLadderMatch(matchId, session.user.id, {
      scheduledAt: parseFromUY(date, time),
      courtNumber: external ? null : courtNumber!,
      external,
    })

    // Aviso a ambos jugadores, igual que cuando confirma el admin.
    const court = COURTS.find((c) => c.number === updated.courtNumber)
    const courtName = updated.externalCourt ? 'Fuera del club' : court?.name || `Cancha ${updated.courtNumber}`
    const dateStr = formatDateUY(updated.scheduledAt!)
    const timeStr = formatTimeUY(updated.scheduledAt!)
    const label = stageLabel(updated.stage)
    const alreadyPlayed = updated.scheduledAt!.getTime() <= Date.now()

    const emails = []
    if (updated.player1?.email) {
      emails.push(sendMatchConfirmationEmail({
        to: updated.player1.email,
        playerName: fullName(updated.player1.firstName, updated.player1.lastName) || 'Jugador',
        rivalName: fullName(updated.player2?.firstName, updated.player2?.lastName) || 'Rival',
        tournamentName: 'La Escalera',
        date: dateStr,
        time: timeStr,
        courtName,
        stageLabel: label,
        alreadyPlayed,
      }))
    }
    if (updated.player2?.email) {
      emails.push(sendMatchConfirmationEmail({
        to: updated.player2.email,
        playerName: fullName(updated.player2.firstName, updated.player2.lastName) || 'Jugador',
        rivalName: fullName(updated.player1?.firstName, updated.player1?.lastName) || 'Rival',
        tournamentName: 'La Escalera',
        date: dateStr,
        time: timeStr,
        courtName,
        stageLabel: label,
        alreadyPlayed,
      }))
    }
    await Promise.allSettled(emails)

    revalidatePath('/')
    revalidatePath('/jugador')
    revalidatePath('/admin')
    revalidatePath('/admin/escalera')
    revalidatePath('/calendario')
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al agendar el partido'
    return { success: false, error: msg }
  }
}

export async function uploadMatchPhotoAction(
  matchId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }

    const match = await getMatchById(matchId)
    if (!match) return { success: false, error: 'Partido no encontrado' }

    const isInMatch = match.player1Id === session.user.id || match.player2Id === session.user.id
    if (!isInMatch) return { success: false, error: 'No autorizado' }
    if (!match.result) return { success: false, error: 'El partido no tiene resultado' }

    // Delete previous photo if exists
    if (match.result.photoUrl) {
      await deleteImage(match.result.photoUrl)
    }

    const uploadResult = await uploadImage(formData)
    if (!uploadResult.success) return { success: false, error: uploadResult.error }

    await updateMatchResultPhoto(matchId, uploadResult.url)

    revalidatePath(`/jugador`)
    revalidatePath(`/admin/partidos`)
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al subir foto'
    return { success: false, error: msg }
  }
}

export async function deleteMatchPhotoAction(
  matchId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }

    const match = await getMatchById(matchId)
    if (!match) return { success: false, error: 'Partido no encontrado' }

    const isInMatch = match.player1Id === session.user.id || match.player2Id === session.user.id
    if (!isInMatch) return { success: false, error: 'No autorizado' }
    if (!match.result?.photoUrl) return { success: false, error: 'No hay foto' }

    await deleteImage(match.result.photoUrl)
    await updateMatchResultPhoto(matchId, null)

    revalidatePath(`/jugador`)
    revalidatePath(`/admin/partidos`)
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al eliminar foto'
    return { success: false, error: msg }
  }
}

export async function cancelReservationAction(
  matchId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }

    const match = await getMatchById(matchId)
    if (!match) return { success: false, error: 'Partido no encontrado' }

    // Both players can cancel
    const isInMatch = match.player1Id === session.user.id || match.player2Id === session.user.id
    if (!isInMatch) return { success: false, error: 'No autorizado para este partido' }

    const reservation = await getReservationByMatch(matchId)
    if (!reservation) return { success: false, error: 'No hay reserva activa' }

    // Plazo nuevo, en la misma transacción que la liberación: soltar el turno para
    // pedir otro no puede acercarlos al vencimiento del partido (antes el reloj seguía
    // corriendo y el cron los mataba esa noche).
    await releaseReservation(reservation.id, matchId)

    revalidatePath('/jugador')
    revalidatePath('/admin')
    revalidatePath('/calendario')
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al cancelar reserva'
    return { success: false, error: msg }
  }
}
