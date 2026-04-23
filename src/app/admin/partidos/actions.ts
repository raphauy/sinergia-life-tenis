'use server'

import { auth } from '@/lib/auth'
import { createMatch, confirmMatch, rescheduleMatch, revertMatchToPending, getMatchById } from '@/services/match-service'
import { createMatchResult, updateMatchResult } from '@/services/match-result-service'
import { notifyMatchResult, notifyMatchResultEdited } from '@/services/match-result-notification'
import { sendMatchConfirmationEmail, sendMatchRescheduledEmail, sendMatchCancelledEmail } from '@/services/email-service'
import { createMatchSchema, confirmMatchSchema } from '@/lib/validations/match'
import { createMatchResultSchema } from '@/lib/validations/match-result'
import { fullName } from '@/lib/format-name'
import { stageLabel } from '@/lib/match-status'
import { parseFromUY, formatDateUY, formatTimeUY } from '@/lib/date-utils'
import { COURTS } from '@/lib/constants'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-types'

function isAdmin(role: string) {
  return role === 'SUPERADMIN' || role === 'ADMIN'
}

export async function createMatchAction(
  data: Record<string, unknown>
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user.role)) {
      return { success: false, error: 'No autorizado' }
    }

    const validated = createMatchSchema.safeParse(data)
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || 'Datos inválidos' }
    }

    const { date, time, ...rest } = validated.data
    const scheduledAt = date && time ? parseFromUY(date, time) : undefined

    const match = await createMatch({ ...rest, scheduledAt })

    revalidatePath('/admin/partidos')
    return { success: true, data: { id: match.id } }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al crear partido'
    return { success: false, error: msg }
  }
}

export async function confirmMatchAction(
  matchId: string,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user.role)) {
      return { success: false, error: 'No autorizado' }
    }

    const validated = confirmMatchSchema.safeParse(data)
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || 'Datos inválidos' }
    }

    const scheduledAt = parseFromUY(validated.data.date, validated.data.time)
    const match = await confirmMatch(matchId, {
      scheduledAt,
      courtNumber: validated.data.courtNumber,
    })

    // Send emails to both players
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
        tournamentName: match.tournament.name,
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
        tournamentName: match.tournament.name,
        date: dateStr,
        time: timeStr,
        courtName: court?.name || `Cancha ${match.courtNumber}`,
        stageLabel: label,
      }))
    }
    await Promise.allSettled(emailPromises)

    revalidatePath('/admin/partidos')
    revalidatePath(`/admin/partidos/${matchId}`)
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al confirmar partido'
    return { success: false, error: msg }
  }
}

export async function rescheduleMatchAction(
  matchId: string,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user.role)) {
      return { success: false, error: 'No autorizado' }
    }

    const validated = confirmMatchSchema.safeParse(data)
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || 'Datos inválidos' }
    }

    const scheduledAt = parseFromUY(validated.data.date, validated.data.time)
    const match = await rescheduleMatch(matchId, {
      scheduledAt,
      courtNumber: validated.data.courtNumber,
    })

    // Send emails to both players
    const court = COURTS.find((c) => c.number === match.courtNumber)
    const dateStr = formatDateUY(match.scheduledAt!)
    const timeStr = formatTimeUY(match.scheduledAt!)

    const emailPromises = []
    if (match.player1?.email) {
      emailPromises.push(sendMatchRescheduledEmail({
        to: match.player1.email,
        playerName: fullName(match.player1.firstName, match.player1.lastName) || 'Jugador',
        rivalName: fullName(match.player2?.firstName, match.player2?.lastName) || 'Rival',
        tournamentName: match.tournament.name,
        date: dateStr,
        time: timeStr,
        courtName: court?.name || `Cancha ${match.courtNumber}`,
      }))
    }
    if (match.player2?.email) {
      emailPromises.push(sendMatchRescheduledEmail({
        to: match.player2.email,
        playerName: fullName(match.player2.firstName, match.player2.lastName) || 'Jugador',
        rivalName: fullName(match.player1?.firstName, match.player1?.lastName) || 'Rival',
        tournamentName: match.tournament.name,
        date: dateStr,
        time: timeStr,
        courtName: court?.name || `Cancha ${match.courtNumber}`,
      }))
    }
    await Promise.allSettled(emailPromises)

    revalidatePath('/admin/partidos')
    revalidatePath(`/admin/partidos/${matchId}`)
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al reprogramar partido'
    return { success: false, error: msg }
  }
}

export async function cancelMatchAction(matchId: string, reason: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user.role)) {
      return { success: false, error: 'No autorizado' }
    }
    if (!reason.trim()) {
      return { success: false, error: 'Motivo requerido' }
    }

    // Get match data before reverting (scheduledAt will be cleared)
    const matchBefore = await getMatchById(matchId)
    if (!matchBefore) return { success: false, error: 'Partido no encontrado' }

    await revertMatchToPending(matchId)
    const adminName = fullName(session.user.firstName, session.user.lastName) || 'Admin'

    // Send cancellation emails with the original schedule data
    if (matchBefore.scheduledAt) {
      const court = COURTS.find((c) => c.number === matchBefore.courtNumber)
      const dateStr = formatDateUY(matchBefore.scheduledAt)
      const timeStr = formatTimeUY(matchBefore.scheduledAt)

      const cancelEmails = []
      if (matchBefore.player1?.email) {
        cancelEmails.push(sendMatchCancelledEmail({
          to: matchBefore.player1.email,
          playerName: fullName(matchBefore.player1.firstName, matchBefore.player1.lastName) || 'Jugador',
          rivalName: fullName(matchBefore.player2?.firstName, matchBefore.player2?.lastName) || 'Rival',
          tournamentName: matchBefore.tournament.name,
          date: dateStr,
          time: timeStr,
          courtName: court?.name || `Cancha ${matchBefore.courtNumber}`,
          reason,
          cancelledByName: adminName,
        }))
      }
      if (matchBefore.player2?.email) {
        cancelEmails.push(sendMatchCancelledEmail({
          to: matchBefore.player2.email,
          playerName: fullName(matchBefore.player2.firstName, matchBefore.player2.lastName) || 'Jugador',
          rivalName: fullName(matchBefore.player1?.firstName, matchBefore.player1?.lastName) || 'Rival',
          tournamentName: matchBefore.tournament.name,
          date: dateStr,
          time: timeStr,
          courtName: court?.name || `Cancha ${matchBefore.courtNumber}`,
          reason,
          cancelledByName: adminName,
        }))
      }
      await Promise.allSettled(cancelEmails)
    }

    revalidatePath('/admin')
    revalidatePath('/admin/partidos')
    revalidatePath(`/admin/partidos/${matchId}`)
    revalidatePath('/jugador')
    revalidatePath('/calendario')
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al cancelar partido'
    return { success: false, error: msg }
  }
}

export async function adminLoadResultAction(
  matchId: string,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user.role)) {
      return { success: false, error: 'No autorizado' }
    }

    const match = await getMatchById(matchId)
    if (!match) return { success: false, error: 'Partido no encontrado' }
    if (!match.player1Id || !match.player2Id) {
      return { success: false, error: 'El partido aún no tiene ambos jugadores asignados' }
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
      return { success: false, error: validated.error.issues[0]?.message || 'Datos inválidos' }
    }

    const isEdit = !!match.result
    if (isEdit) {
      await updateMatchResult(matchId, validated.data)
    } else {
      await createMatchResult({
        matchId,
        reportedById: session.user.id,
        ...validated.data,
      })
    }

    // Notify group players + admins (fire-and-forget)
    const updatedMatch = await getMatchById(matchId)
    if (updatedMatch) {
      const adminName = fullName(session.user.firstName, session.user.lastName) || 'Admin'
      if (isEdit) {
        notifyMatchResultEdited(updatedMatch, adminName)
      } else {
        notifyMatchResult(updatedMatch)
      }
    }

    revalidatePath('/admin/partidos')
    revalidatePath(`/admin/partidos/${matchId}`)
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al cargar resultado'
    return { success: false, error: msg }
  }
}

export async function getPlayersByCategoryAction(
  categoryId: string
): Promise<ActionResult<Array<{ id: string; name: string; userId: string }>>> {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user.role)) {
      return { success: false, error: 'No autorizado' }
    }

    const players = await prisma.player.findMany({
      where: { categoryId, userId: { not: null }, isActive: true },
      select: { id: true, firstName: true, lastName: true, userId: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })

    return {
      success: true,
      data: players.map((p) => ({ id: p.id, name: fullName(p.firstName, p.lastName), userId: p.userId! })),
    }
  } catch {
    return { success: false, error: 'Error al obtener jugadores' }
  }
}
