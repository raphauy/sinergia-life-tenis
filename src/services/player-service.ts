import { prisma } from '@/lib/prisma'

export async function getPlayersByTournament(tournamentId: string) {
  return prisma.player.findMany({
    where: { tournamentId },
    include: {
      category: { select: { id: true, name: true } },
      user: { select: { name: true } },
    },
    orderBy: [{ category: { order: 'asc' } }, { name: 'asc' }],
  })
}

export async function getPlayerById(id: string) {
  return prisma.player.findUnique({
    where: { id },
    include: {
      category: true,
      tournament: true,
      user: true,
    },
  })
}

export async function updatePlayerEmail(playerId: string, email: string) {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) throw new Error('Email requerido')

  // Check if email is already used by another player in same tournament
  const player = await prisma.player.findUnique({ where: { id: playerId } })
  if (!player) throw new Error('Jugador no encontrado')

  const existing = await prisma.player.findFirst({
    where: {
      tournamentId: player.tournamentId,
      email: trimmed,
      id: { not: playerId },
    },
  })
  if (existing) throw new Error('Ese email ya está asignado a otro jugador del torneo')

  // If a user with this email exists, link them
  const existingUser = await prisma.user.findUnique({ where: { email: trimmed } })

  return prisma.player.update({
    where: { id: playerId },
    data: {
      email: trimmed,
      userId: existingUser?.id ?? player.userId,
    },
  })
}

export async function updatePlayerWhatsapp(playerId: string, whatsapp: string) {
  return prisma.player.update({
    where: { id: playerId },
    data: { whatsappNumber: whatsapp.trim() || null },
  })
}

export async function updatePlayerName(playerId: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Nombre requerido')

  return prisma.player.update({
    where: { id: playerId },
    data: { name: trimmed },
  })
}

export async function createPlayer(data: {
  tournamentId: string
  categoryId: string
  name: string
  email?: string
  whatsappNumber?: string
}) {
  // If email provided and user exists, link
  let userId: string | undefined
  if (data.email) {
    const user = await prisma.user.findUnique({ where: { email: data.email } })
    if (user) userId = user.id
  }

  return prisma.player.create({
    data: {
      ...data,
      userId,
    },
  })
}

export async function deletePlayer(playerId: string) {
  return prisma.player.delete({ where: { id: playerId } })
}

export async function deleteManyPlayers(playerIds: string[]) {
  return prisma.player.deleteMany({ where: { id: { in: playerIds } } })
}

export async function linkPlayerToUser(playerId: string, userId: string) {
  return prisma.player.update({
    where: { id: playerId },
    data: { userId, acceptedAt: new Date() },
  })
}
