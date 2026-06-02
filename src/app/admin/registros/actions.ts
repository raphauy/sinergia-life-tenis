'use server'

import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { approvePlayerRegistration, rejectPlayerRegistration } from '@/services/player-registration-service'
import type { ActionResult } from '@/lib/action-types'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return null
  }
  return session.user
}

export async function approvePlayerRegistrationAction(
  id: string
): Promise<ActionResult<{ rating: number; playerName: string }>> {
  try {
    const admin = await requireAdmin()
    if (!admin) return { success: false, error: 'No autorizado' }

    const res = await approvePlayerRegistration(id, admin.id)
    revalidatePath('/admin/registros')
    revalidatePath('/admin') // banner del layout
    revalidatePath('/') // escalera
    return {
      success: true,
      data: { rating: res.rating, playerName: res.playerName },
      message: `${res.playerName} entró a La Escalera con ${res.rating} puntos.`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al aprobar el registro'
    return { success: false, error: message }
  }
}

export async function rejectPlayerRegistrationAction(id: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin()
    if (!admin) return { success: false, error: 'No autorizado' }

    await rejectPlayerRegistration(id, admin.id)
    revalidatePath('/admin/registros')
    revalidatePath('/admin')
    return { success: true, message: 'Solicitud rechazada.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al rechazar el registro'
    return { success: false, error: message }
  }
}
