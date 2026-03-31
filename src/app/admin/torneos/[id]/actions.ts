'use server'

import { auth } from '@/lib/auth'
import { updatePlayerEmail, updatePlayerName, updatePlayerWhatsapp, deletePlayer, deleteManyPlayers } from '@/services/player-service'
import { invitePlayer } from '@/services/player-invitation-service'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-types'

export async function updatePlayerNameAction(
  tournamentId: string,
  playerId: string,
  name: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await updatePlayerName(playerId, name)
    revalidatePath(`/admin/torneos/${tournamentId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar nombre'
    return { success: false, error: message }
  }
}

export async function updatePlayerWhatsappAction(
  tournamentId: string,
  playerId: string,
  whatsapp: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await updatePlayerWhatsapp(playerId, whatsapp)
    revalidatePath(`/admin/torneos/${tournamentId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar WhatsApp'
    return { success: false, error: message }
  }
}

export async function updatePlayerEmailAction(
  tournamentId: string,
  playerId: string,
  email: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await updatePlayerEmail(playerId, email)
    revalidatePath(`/admin/torneos/${tournamentId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar email'
    return { success: false, error: message }
  }
}

export async function invitePlayerAction(
  tournamentId: string,
  playerId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await invitePlayer(playerId)
    revalidatePath(`/admin/torneos/${tournamentId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al invitar jugador'
    return { success: false, error: message }
  }
}

export async function deletePlayerAction(
  tournamentId: string,
  playerId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await deletePlayer(playerId)
    revalidatePath(`/admin/torneos/${tournamentId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar jugador'
    return { success: false, error: message }
  }
}

export async function deleteManyPlayersAction(
  tournamentId: string,
  playerIds: string[]
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    if (playerIds.length === 0) return { success: false, error: 'No hay jugadores seleccionados' }

    await deleteManyPlayers(playerIds)
    revalidatePath(`/admin/torneos/${tournamentId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar jugadores'
    return { success: false, error: message }
  }
}
