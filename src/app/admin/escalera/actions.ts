'use server'

import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-types'
import { commitSeed, resetSeed, updateLadderConfig } from '@/services/ladder-service'
import { adminCancelChallenge } from '@/services/challenge-service'
import { closeLadderMonth, runLadderDailyTasks } from '@/services/ladder-cron-service'
import { ladderConfigSchema } from '@/lib/validations/ladder'
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

export async function updateLadderConfigAction(data: Record<string, unknown>): Promise<ActionResult> {
  try {
    if (!(await requireAdmin())) return { success: false, error: 'No autorizado' }

    const validated = ladderConfigSchema.safeParse(data)
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || 'Datos inválidos' }
    }

    await updateLadderConfig(validated.data)
    // kFactor/matchFormat afectan previews y partidos futuros → revalidar home.
    revalidatePath('/')
    revalidatePath('/admin/escalera')
    return { success: true, message: 'Configuración guardada.' }
  } catch (error) {
    console.error('Error guardando la config de la escalera:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error al guardar la configuración' }
  }
}

export async function closeMonthAction(year: number, month: number): Promise<ActionResult> {
  try {
    if (!(await requireAdmin())) return { success: false, error: 'No autorizado' }
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return { success: false, error: 'Período inválido' }
    }

    const res = await closeLadderMonth(year, month)
    revalidatePath('/')
    revalidatePath('/admin/escalera')
    if (res.alreadyClosed) {
      return { success: true, message: `El mes ${month}/${year} ya estaba cerrado (no se hizo nada).` }
    }
    return {
      success: true,
      message: `Mes ${month}/${year} cerrado: ${res.penalized.length} penalizados de ${res.processed} miembros.`,
    }
  } catch (error) {
    console.error('Error cerrando el mes:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error al cerrar el mes' }
  }
}

export async function runDailyTasksAction(): Promise<ActionResult> {
  try {
    if (!(await requireAdmin())) return { success: false, error: 'No autorizado' }

    const r = await runLadderDailyTasks()
    revalidatePath('/')
    revalidatePath('/admin/escalera')
    return {
      success: true,
      message: `Tareas diarias: ${r.matchesWarned} avisados, ${r.matchesCancelled} cancelados, ${r.monthWarnings} avisos de cierre.`,
    }
  } catch (error) {
    console.error('Error corriendo tareas diarias:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error al correr las tareas diarias' }
  }
}

export async function cancelChallengeAdminAction(challengeId: string): Promise<ActionResult> {
  try {
    if (!(await requireAdmin())) return { success: false, error: 'No autorizado' }

    await adminCancelChallenge(challengeId)
    revalidatePath('/')
    revalidatePath('/admin/escalera')
    return { success: true, message: 'Reto cancelado.' }
  } catch (error) {
    console.error('Error cancelando el reto:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error al cancelar el reto' }
  }
}
