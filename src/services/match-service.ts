import { prisma } from '@/lib/prisma'
import type { MatchStatus } from '@prisma/client'

const matchIncludes = {
  player1: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, image: true } },
  player2: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, image: true } },
  tournament: { select: { id: true, name: true, matchFormat: true } },
  category: { select: { id: true, name: true } },
  group: { select: { id: true, number: true } },
  result: { include: { reportedBy: { select: { firstName: true, lastName: true } } } },
} as const

export async function createMatch(data: {
  tournamentId: string
  categoryId: string
  player1Id: string
  player2Id: string
  courtNumber?: number
  scheduledAt?: Date
}) {
  const isConfirmed = data.scheduledAt && data.courtNumber

  return prisma.match.create({
    data: {
      tournamentId: data.tournamentId,
      categoryId: data.categoryId,
      player1Id: data.player1Id,
      player2Id: data.player2Id,
      courtNumber: data.courtNumber,
      scheduledAt: data.scheduledAt,
      status: isConfirmed ? 'CONFIRMED' : 'PENDING',
      confirmedAt: isConfirmed ? new Date() : undefined,
    },
    include: matchIncludes,
  })
}

export async function getMatches(filters?: {
  tournamentId?: string
  categoryId?: string
  groupId?: string
  status?: MatchStatus
}) {
  return prisma.match.findMany({
    where: {
      ...(filters?.tournamentId ? { tournamentId: filters.tournamentId } : {}),
      ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters?.groupId ? { groupId: filters.groupId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    },
    include: matchIncludes,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getMatchById(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: matchIncludes,
  })
}

export async function confirmMatch(
  id: string,
  data: { scheduledAt: Date; courtNumber: number }
) {
  const match = await prisma.match.findUnique({ where: { id } })
  if (!match) throw new Error('Partido no encontrado')
  if (match.status !== 'PENDING') throw new Error('Solo se pueden confirmar partidos pendientes')

  return prisma.match.update({
    where: { id },
    data: {
      scheduledAt: data.scheduledAt,
      courtNumber: data.courtNumber,
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    },
    include: matchIncludes,
  })
}

export async function rescheduleMatch(
  id: string,
  data: { scheduledAt: Date; courtNumber: number }
) {
  const match = await prisma.match.findUnique({ where: { id } })
  if (!match) throw new Error('Partido no encontrado')
  if (match.status !== 'CONFIRMED') throw new Error('Solo se pueden reprogramar partidos confirmados')

  return prisma.match.update({
    where: { id },
    data: {
      scheduledAt: data.scheduledAt,
      courtNumber: data.courtNumber,
    },
    include: matchIncludes,
  })
}

export async function cancelMatch(id: string) {
  const match = await prisma.match.findUnique({ where: { id } })
  if (!match) throw new Error('Partido no encontrado')
  if (match.status === 'PLAYED') throw new Error('No se puede cancelar un partido ya jugado')

  return prisma.match.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })
}

export async function getMatchesByPlayer(userId: string) {
  return prisma.match.findMany({
    where: {
      OR: [{ player1Id: userId }, { player2Id: userId }],
    },
    include: matchIncludes,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getUpcomingMatches(userId: string) {
  return prisma.match.findMany({
    where: {
      OR: [{ player1Id: userId }, { player2Id: userId }],
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    include: matchIncludes,
    orderBy: { createdAt: 'desc' },
  })
}
