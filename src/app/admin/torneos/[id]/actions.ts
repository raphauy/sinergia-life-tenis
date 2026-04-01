'use server'

import { auth } from '@/lib/auth'
import { updatePlayerEmail, updatePlayerName, updatePlayerWhatsapp, deletePlayer, deleteManyPlayers } from '@/services/player-service'
import { invitePlayer, forceAcceptPlayer } from '@/services/player-invitation-service'
import { createGroup, deleteGroup, setGroupPlayers, getAffectedPendingMatches, generateRoundRobinMatches, deletePendingMatches } from '@/services/group-service'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-types'

export async function updatePlayerNameAction(
  tournamentId: string,
  playerId: string,
  firstName: string,
  lastName: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await updatePlayerName(playerId, firstName, lastName)
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

export async function forceAcceptPlayerAction(
  tournamentId: string,
  playerId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await forceAcceptPlayer(playerId)
    revalidatePath(`/admin/torneos/${tournamentId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al marcar jugador como aceptado'
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

// ============================================================================
// GROUP ACTIONS
// ============================================================================

export async function createGroupAction(
  tournamentId: string,
  categoryId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await createGroup(categoryId)
    revalidatePath(`/admin/torneos/${tournamentId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear grupo'
    return { success: false, error: message }
  }
}

export async function deleteGroupAction(
  tournamentId: string,
  groupId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await deleteGroup(groupId)
    revalidatePath(`/admin/torneos/${tournamentId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar grupo'
    return { success: false, error: message }
  }
}

export async function checkAffectedMatchesAction(
  groupId: string,
  playerIds: string[]
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    const count = await getAffectedPendingMatches(groupId, playerIds)
    return { success: true, data: { count } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al verificar partidos'
    return { success: false, error: message }
  }
}

export async function setGroupPlayersAction(
  tournamentId: string,
  groupId: string,
  playerIds: string[],
  cancelPending: boolean = false
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await setGroupPlayers(groupId, playerIds, cancelPending)
    revalidatePath(`/admin/torneos/${tournamentId}`)
    revalidatePath('/admin/partidos')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al asignar jugadores'
    return { success: false, error: message }
  }
}

export async function generateRoundRobinMatchesAction(
  tournamentId: string,
  groupId: string
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    const count = await generateRoundRobinMatches(groupId)
    revalidatePath(`/admin/torneos/${tournamentId}`)
    revalidatePath('/admin/partidos')
    return { success: true, data: { count } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al generar partidos'
    return { success: false, error: message }
  }
}

export async function deletePendingMatchesAction(
  tournamentId: string,
  groupId: string
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    const count = await deletePendingMatches(groupId)
    revalidatePath(`/admin/torneos/${tournamentId}`)
    revalidatePath('/admin/partidos')
    return { success: true, data: { count } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar partidos'
    return { success: false, error: message }
  }
}
