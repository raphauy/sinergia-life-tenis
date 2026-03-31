import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function createManyImportedPlayers(
  tournamentId: string,
  rows: Array<{
    name: string
    category: string
    whatsappNumber?: string
    email?: string
    data: Record<string, unknown>
  }>
) {
  return prisma.importedPlayer.createMany({
    data: rows.map((row) => ({
      tournamentId,
      name: row.name,
      category: row.category,
      whatsappNumber: row.whatsappNumber,
      email: row.email,
      data: row.data as Prisma.InputJsonValue,
    })),
  })
}

export async function getImportedPlayers(tournamentId: string) {
  return prisma.importedPlayer.findMany({
    where: { tournamentId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getPendingImportedPlayers(tournamentId: string) {
  return prisma.importedPlayer.findMany({
    where: { tournamentId, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  })
}

export async function processImportedPlayers(tournamentId: string) {
  const pending = await getPendingImportedPlayers(tournamentId)

  // Get categories for this tournament
  const categories = await prisma.tournamentCategory.findMany({
    where: { tournamentId },
  })
  const categoryMap = new Map(categories.map((c) => [c.name.toUpperCase(), c.id]))

  let processed = 0
  let errors = 0

  for (const row of pending) {
    try {
      const categoryId = categoryMap.get(row.category.toUpperCase())
      if (!categoryId) {
        await prisma.importedPlayer.update({
          where: { id: row.id },
          data: { status: 'ERROR', error: `Categoría "${row.category}" no encontrada` },
        })
        errors++
        continue
      }

      // Check if player already exists in tournament by email
      let existingPlayer = null
      if (row.email) {
        existingPlayer = await prisma.player.findFirst({
          where: { tournamentId, email: row.email.toLowerCase() },
        })
      }

      if (existingPlayer) {
        await prisma.importedPlayer.update({
          where: { id: row.id },
          data: { status: 'PROCESSED', error: 'Jugador ya existe (por email)' },
        })
        processed++
        continue
      }

      // Check if user with email exists
      let userId: string | undefined
      if (row.email) {
        const user = await prisma.user.findUnique({
          where: { email: row.email.toLowerCase() },
        })
        if (user) userId = user.id
      }

      await prisma.player.create({
        data: {
          tournamentId,
          categoryId,
          name: row.name,
          email: row.email?.toLowerCase(),
          whatsappNumber: row.whatsappNumber,
          userId,
        },
      })

      await prisma.importedPlayer.update({
        where: { id: row.id },
        data: { status: 'PROCESSED' },
      })
      processed++
    } catch (error) {
      await prisma.importedPlayer.update({
        where: { id: row.id },
        data: {
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Error desconocido',
        },
      })
      errors++
    }
  }

  return { processed, errors, total: pending.length }
}

export async function deleteImportedPlayers(tournamentId: string) {
  return prisma.importedPlayer.deleteMany({ where: { tournamentId } })
}
