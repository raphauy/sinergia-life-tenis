import { prisma } from '@/lib/prisma'
import type { MatchFormat } from '@/generated/prisma/client'

export async function createTournament(data: {
  name: string
  description?: string
  startDate: Date
  endDate: Date
  categories: string[]
  matchFormat?: MatchFormat
}) {
  return prisma.tournament.create({
    data: {
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      matchFormat: data.matchFormat || 'SINGLE_SET',
      categories: {
        create: data.categories.map((name, index) => ({
          name,
          order: index,
        })),
      },
    },
    include: { categories: true },
  })
}

export async function getTournaments() {
  return prisma.tournament.findMany({
    include: {
      categories: { orderBy: { order: 'asc' } },
      _count: { select: { players: true, matches: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getTournamentById(id: string) {
  return prisma.tournament.findUnique({
    where: { id },
    include: {
      categories: { orderBy: { order: 'asc' } },
      _count: { select: { players: true, matches: true } },
    },
  })
}

export async function updateTournament(
  id: string,
  data: {
    name?: string
    description?: string
    startDate?: Date
    endDate?: Date
    isActive?: boolean
  }
) {
  return prisma.tournament.update({
    where: { id },
    data,
    include: { categories: { orderBy: { order: 'asc' } } },
  })
}

export async function getActiveTournament() {
  return prisma.tournament.findFirst({
    where: { isActive: true },
    include: {
      categories: { orderBy: { order: 'asc' } },
    },
  })
}
