'use server'

import { auth } from '@/lib/auth'
import {
  createManyImportedPlayers,
  processImportedPlayers,
  deleteImportedPlayers,
} from '@/services/imported-player-service'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-types'

export async function uploadCsvAction(
  tournamentId: string,
  rows: Array<{
    name: string
    category: string
    whatsappNumber?: string
    email?: string
    data: Record<string, unknown>
  }>
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    if (rows.length === 0) return { success: false, error: 'No hay filas para importar' }

    // Clean old imports
    await deleteImportedPlayers(tournamentId)

    await createManyImportedPlayers(tournamentId, rows)

    return { success: true, data: { count: rows.length } }
  } catch (error) {
    console.error('Error uploading CSV:', error)
    return { success: false, error: 'Error al subir el CSV' }
  }
}

export async function confirmImportAction(
  tournamentId: string
): Promise<ActionResult<{ processed: number; errors: number }>> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    const result = await processImportedPlayers(tournamentId)

    revalidatePath(`/admin/torneos/${tournamentId}`)
    revalidatePath(`/admin/torneos/${tournamentId}/importar`)
    return {
      success: true,
      data: { processed: result.processed, errors: result.errors },
    }
  } catch (error) {
    console.error('Error processing import:', error)
    return { success: false, error: 'Error al procesar la importación' }
  }
}
