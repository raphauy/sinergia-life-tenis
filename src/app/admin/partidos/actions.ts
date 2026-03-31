'use server'

import { auth } from '@/lib/auth'
import { createMatch, confirmMatch, cancelMatch, getMatchById } from '@/services/match-service'
import { createMatchResult, updateMatchResult } from '@/services/match-result-service'
import { sendMatchConfirmationEmail } from '@/services/email-service'
import { createMatchSchema, confirmMatchSchema } from '@/lib/validations/match'
import { createMatchResultSchema } from '@/lib/validations/match-result'
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

    const emailPromises = [
      sendMatchConfirmationEmail({
        to: match.player1.email,
        playerName: match.player1.name || 'Jugador',
        rivalName: match.player2.name || 'Rival',
        tournamentName: match.tournament.name,
        date: dateStr,
        time: timeStr,
        courtName: court?.name || `Cancha ${match.courtNumber}`,
      }),
      sendMatchConfirmationEmail({
        to: match.player2.email,
        playerName: match.player2.name || 'Jugador',
        rivalName: match.player1.name || 'Rival',
        tournamentName: match.tournament.name,
        date: dateStr,
        time: timeStr,
        courtName: court?.name || `Cancha ${match.courtNumber}`,
      }),
    ]
    await Promise.allSettled(emailPromises)

    revalidatePath('/admin/partidos')
    revalidatePath(`/admin/partidos/${matchId}`)
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al confirmar partido'
    return { success: false, error: msg }
  }
}

export async function cancelMatchAction(matchId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user.role)) {
      return { success: false, error: 'No autorizado' }
    }

    await cancelMatch(matchId)
    revalidatePath('/admin/partidos')
    revalidatePath(`/admin/partidos/${matchId}`)
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

    const schema = createMatchResultSchema(
      match.tournament.matchFormat,
      match.player1Id,
      match.player2Id
    )
    const validated = schema.safeParse(data)
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || 'Datos inválidos' }
    }

    if (match.result) {
      await updateMatchResult(matchId, validated.data)
    } else {
      await createMatchResult({
        matchId,
        reportedById: session.user.id,
        ...validated.data,
      })
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
      select: { id: true, name: true, userId: true },
      orderBy: { name: 'asc' },
    })

    return {
      success: true,
      data: players.map((p) => ({ id: p.id, name: p.name, userId: p.userId! })),
    }
  } catch {
    return { success: false, error: 'Error al obtener jugadores' }
  }
}
