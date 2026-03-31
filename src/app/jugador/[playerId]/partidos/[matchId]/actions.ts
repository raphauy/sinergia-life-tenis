'use server'

import { auth } from '@/lib/auth'
import { getMatchById } from '@/services/match-service'
import { createMatchResult } from '@/services/match-result-service'
import { createMatchResultSchema } from '@/lib/validations/match-result'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-types'

export async function playerLoadResultAction(
  matchId: string,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }

    const match = await getMatchById(matchId)
    if (!match) return { success: false, error: 'Partido no encontrado' }

    // Auth: user must be player1 or player2
    const isInMatch =
      match.player1Id === session.user.id || match.player2Id === session.user.id
    const isAdmin = session.user.role === 'SUPERADMIN' || session.user.role === 'ADMIN'

    if (!isInMatch && !isAdmin) {
      return { success: false, error: 'No autorizado para este partido' }
    }

    if (match.status !== 'CONFIRMED') {
      return { success: false, error: 'El partido debe estar confirmado' }
    }

    if (match.result) {
      return { success: false, error: 'Este partido ya tiene resultado' }
    }

    const schema = createMatchResultSchema(
      match.tournament.matchFormat,
      match.player1Id,
      match.player2Id
    )
    const validated = schema.safeParse(data)
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || 'Datos inválidos',
      }
    }

    await createMatchResult({
      matchId,
      reportedById: session.user.id,
      ...validated.data,
    })

    revalidatePath(`/jugador`)
    revalidatePath(`/admin/partidos`)
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al cargar resultado'
    return { success: false, error: msg }
  }
}
