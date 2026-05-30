'use server'

import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-types'
import { commitSeed, resetSeed } from '@/services/ladder-service'
import { seedCommitSchema } from '@/lib/validations/ladder'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return null
  }
  return session.user
}

export async function commitSeedAction(
  data: Record<string, unknown>
): Promise<ActionResult<{ membersCreated: number }>> {
  try {
    if (!(await requireAdmin())) return { success: false, error: 'No autorizado' }

    const validated = seedCommitSchema.safeParse(data)
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || 'Datos inválidos' }
    }

    const res = await commitSeed(validated.data.items)
    revalidatePath('/')
    revalidatePath('/admin/escalera')
    return {
      success: true,
      data: { membersCreated: res.membersCreated },
      message: `La Escalera se sembró con ${res.membersCreated} jugadores.`,
    }
  } catch (error) {
    console.error('Error sembrando la escalera:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error al sembrar la escalera' }
  }
}

export async function resetSeedAction(): Promise<ActionResult> {
  try {
    if (!(await requireAdmin())) return { success: false, error: 'No autorizado' }

    await resetSeed()
    revalidatePath('/')
    revalidatePath('/admin/escalera')
    return { success: true, message: 'La Escalera se reinició. Podés volver a sembrarla.' }
  } catch (error) {
    console.error('Error reiniciando la escalera:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error al reiniciar la escalera' }
  }
}
