'use server'

import { auth } from '@/lib/auth'
import {
  createAdminInvitation,
  cancelAdminInvitation,
} from '@/services/admin-invitation-service'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-types'

export async function createAdminInvitationAction(data: {
  email: string
  name?: string
}): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SUPERADMIN') {
      return { success: false, error: 'No autorizado' }
    }

    await createAdminInvitation({
      email: data.email,
      name: data.name,
      invitedById: session.user.id,
    })

    revalidatePath('/admin/invitaciones')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear invitación'
    return { success: false, error: message }
  }
}

export async function cancelAdminInvitationAction(id: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SUPERADMIN') {
      return { success: false, error: 'No autorizado' }
    }

    await cancelAdminInvitation(id)
    revalidatePath('/admin/invitaciones')
    return { success: true }
  } catch (error) {
    console.error('Error canceling invitation:', error)
    return { success: false, error: 'Error al cancelar invitación' }
  }
}
