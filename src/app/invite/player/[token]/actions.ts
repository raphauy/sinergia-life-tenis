'use server'

import { acceptPlayerInvitation } from '@/services/player-invitation-service'
import type { ActionResult } from '@/lib/action-types'

export async function acceptPlayerInvitationAction(
  token: string
): Promise<ActionResult> {
  try {
    await acceptPlayerInvitation(token)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al aceptar invitación'
    return { success: false, error: message }
  }
}
