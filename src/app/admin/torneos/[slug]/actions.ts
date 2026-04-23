'use server'

import { auth } from '@/lib/auth'
import { updatePlayerEmail, updatePlayerName, updatePlayerWhatsapp, deletePlayer, deleteManyPlayers } from '@/services/player-service'
import { invitePlayer, forceAcceptPlayer } from '@/services/player-invitation-service'
import { createGroup, deleteGroup, setGroupPlayers, getAffectedPendingMatches, generateRoundRobinMatches, deletePendingMatches } from '@/services/group-service'
import { generateBracket, regenerateBracket, deleteBracket, previewBracket } from '@/services/bracket-service'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-types'

export async function updatePlayerNameAction(
  tournamentSlug: string,
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
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar nombre'
    return { success: false, error: message }
  }
}

export async function updatePlayerWhatsappAction(
  tournamentSlug: string,
  playerId: string,
  whatsapp: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await updatePlayerWhatsapp(playerId, whatsapp)
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar WhatsApp'
    return { success: false, error: message }
  }
}

export async function updatePlayerEmailAction(
  tournamentSlug: string,
  playerId: string,
  email: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await updatePlayerEmail(playerId, email)
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar email'
    return { success: false, error: message }
  }
}

export async function invitePlayerAction(
  tournamentSlug: string,
  playerId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await invitePlayer(playerId)
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al invitar jugador'
    return { success: false, error: message }
  }
}

export async function forceAcceptPlayerAction(
  tournamentSlug: string,
  playerId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await forceAcceptPlayer(playerId)
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al marcar jugador como aceptado'
    return { success: false, error: message }
  }
}

export async function deletePlayerAction(
  tournamentSlug: string,
  playerId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await deletePlayer(playerId)
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar jugador'
    return { success: false, error: message }
  }
}

export async function deleteManyPlayersAction(
  tournamentSlug: string,
  playerIds: string[]
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    if (playerIds.length === 0) return { success: false, error: 'No hay jugadores seleccionados' }

    await deleteManyPlayers(playerIds)
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
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
  tournamentSlug: string,
  categoryId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await createGroup(categoryId)
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear grupo'
    return { success: false, error: message }
  }
}

export async function deleteGroupAction(
  tournamentSlug: string,
  groupId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await deleteGroup(groupId)
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
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
  tournamentSlug: string,
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
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
    revalidatePath('/admin/partidos')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al asignar jugadores'
    return { success: false, error: message }
  }
}

export async function generateRoundRobinMatchesAction(
  tournamentSlug: string,
  groupId: string
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    const count = await generateRoundRobinMatches(groupId)
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
    revalidatePath('/admin/partidos')
    return { success: true, data: { count } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al generar partidos'
    return { success: false, error: message }
  }
}

export async function deletePendingMatchesAction(
  tournamentSlug: string,
  groupId: string
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    const count = await deletePendingMatches(groupId)
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
    revalidatePath('/admin/partidos')
    return { success: true, data: { count } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar partidos'
    return { success: false, error: message }
  }
}

// ============================================================================
// BRACKET ACTIONS
// ============================================================================

export async function previewBracketAction(
  categoryId: string,
): Promise<ActionResult<{ format: '4-groups' | '3-groups'; pendingGroupNumbers: number[] }>> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    const preview = await previewBracket(categoryId)
    return {
      success: true,
      data: {
        format: preview.format,
        pendingGroupNumbers: preview.pendingGroups.map((g) => g.groupNumber),
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al analizar bracket'
    return { success: false, error: message }
  }
}

export async function generateBracketAction(
  tournamentSlug: string,
  categoryId: string,
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await generateBracket(categoryId)
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
    revalidatePath('/admin/partidos')
    revalidatePath('/')
    revalidatePath('/fixture')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al generar bracket'
    return { success: false, error: message }
  }
}

export async function regenerateBracketAction(
  tournamentSlug: string,
  categoryId: string,
  force: boolean,
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await regenerateBracket(categoryId, { force })
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
    revalidatePath('/admin/partidos')
    revalidatePath('/')
    revalidatePath('/fixture')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al regenerar bracket'
    return { success: false, error: message }
  }
}

export async function deleteBracketAction(
  tournamentSlug: string,
  categoryId: string,
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    const count = await deleteBracket(categoryId)
    revalidatePath(`/admin/torneos/${tournamentSlug}`)
    revalidatePath('/admin/partidos')
    revalidatePath('/')
    revalidatePath('/fixture')
    return { success: true, data: { count } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar bracket'
    return { success: false, error: message }
  }
}
