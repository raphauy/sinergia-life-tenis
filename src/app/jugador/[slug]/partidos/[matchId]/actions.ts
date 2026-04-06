'use server'

import { auth } from '@/lib/auth'
import { getMatchById } from '@/services/match-service'
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
import { createReservation, getReservationsByMonth, getReservationByMatch, deleteReservation, mapReservationToCalendar } from '@/services/reservation-service'
import { getUserById, updateUser } from '@/services/user-service'
import { parseFromUY } from '@/lib/date-utils'
import { getMinReservationDate, TIMEZONE } from '@/lib/constants'
import { toZonedTime } from 'date-fns-tz'

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

    const isWalkover = data.walkover === true || data.walkover === 'true'
    const schema = createMatchResultSchema(
      match.tournament.matchFormat,
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
  tournamentId: string,
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
    player1Name: fullName(m.player1.firstName, m.player1.lastName),
    player2Name: fullName(m.player2.firstName, m.player2.lastName),
    categoryName: m.category.name,
    groupNumber: m.group?.number ?? null,
  }))
}

export async function fetchMonthReservationsAction(
  tournamentId: string,
  year: number,
  month: number
): Promise<CalendarReservation[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  const reservations = await getReservationsByMonth(tournamentId, year, month)
  return reservations.map(mapReservationToCalendar)
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

    await deleteReservation(reservation.id)

    revalidatePath('/jugador')
    revalidatePath('/admin')
    revalidatePath('/calendario')
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al cancelar reserva'
    return { success: false, error: msg }
  }
}
