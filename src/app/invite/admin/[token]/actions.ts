'use server'

import { acceptAdminInvitation } from '@/services/admin-invitation-service'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-types'

export async function acceptAdminInvitationAction(
  token: string
): Promise<ActionResult> {
  try {
    await acceptAdminInvitation(token)
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al aceptar invitación'
    return { success: false, error: message }
  }
}
