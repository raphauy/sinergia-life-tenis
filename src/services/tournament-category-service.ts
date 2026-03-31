import { prisma } from '@/lib/prisma'

export async function getCategoriesByTournament(tournamentId: string) {
  return prisma.tournamentCategory.findMany({
    where: { tournamentId },
    orderBy: { order: 'asc' },
    include: { _count: { select: { players: true } } },
  })
}

export async function createCategory(data: {
  tournamentId: string
  name: string
  description?: string
  order?: number
}) {
  return prisma.tournamentCategory.create({ data })
}

export async function deleteCategory(id: string) {
  return prisma.tournamentCategory.delete({ where: { id } })
}
