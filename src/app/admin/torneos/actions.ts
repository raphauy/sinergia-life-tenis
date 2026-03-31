'use server'

import { auth } from '@/lib/auth'
import { createTournament, updateTournament } from '@/services/tournament-service'
import { createCategory, deleteCategory } from '@/services/tournament-category-service'
import { createTournamentSchema, updateTournamentSchema } from '@/lib/validations/tournament'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-types'

export async function createTournamentAction(
  data: Record<string, unknown>
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    const validated = createTournamentSchema.safeParse(data)
    if (!validated.success) {
      const firstError = validated.error.issues[0]?.message || 'Datos inválidos'
      return { success: false, error: firstError }
    }

    const tournament = await createTournament({
      name: validated.data.name,
      description: validated.data.description,
      startDate: new Date(validated.data.startDate),
      endDate: new Date(validated.data.endDate),
      categories: validated.data.categories,
    })

    revalidatePath('/admin/torneos')
    return { success: true, data: { id: tournament.id } }
  } catch (error) {
    console.error('Error creating tournament:', error)
    return { success: false, error: 'Error al crear el torneo' }
  }
}

export async function updateTournamentAction(
  id: string,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    const validated = updateTournamentSchema.safeParse(data)
    if (!validated.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    await updateTournament(id, {
      ...validated.data,
      startDate: validated.data.startDate ? new Date(validated.data.startDate) : undefined,
      endDate: validated.data.endDate ? new Date(validated.data.endDate) : undefined,
    })

    revalidatePath('/admin/torneos')
    revalidatePath(`/admin/torneos/${id}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating tournament:', error)
    return { success: false, error: 'Error al actualizar el torneo' }
  }
}

export async function addCategoryAction(
  tournamentId: string,
  name: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    if (!name.trim()) return { success: false, error: 'Nombre requerido' }

    await createCategory({ tournamentId, name: name.trim() })
    revalidatePath(`/admin/torneos/${tournamentId}`)
    return { success: true }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return { success: false, error: 'Ya existe una categoría con ese nombre' }
    }
    console.error('Error adding category:', error)
    return { success: false, error: 'Error al agregar categoría' }
  }
}

export async function deleteCategoryAction(
  tournamentId: string,
  categoryId: string
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
      return { success: false, error: 'No autorizado' }
    }

    await deleteCategory(categoryId)
    revalidatePath(`/admin/torneos/${tournamentId}`)
    return { success: true }
  } catch (error) {
    console.error('Error deleting category:', error)
    return { success: false, error: 'No se puede eliminar la categoría (puede tener jugadores o partidos)' }
  }
}
