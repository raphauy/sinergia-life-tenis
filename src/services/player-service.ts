import { prisma } from '@/lib/prisma'
import { generateSlug } from '@/lib/utils'

export async function generateUniquePlayerSlug(firstName: string, lastName: string, excludeId?: string): Promise<string> {
  const baseSlug = generateSlug(`${firstName} ${lastName}`) || 'jugador'
  let slug = baseSlug
  let suffix = 0

  while (true) {
    const existing = await prisma.player.findUnique({ where: { slug } })
    if (!existing || existing.id === excludeId) break
    suffix++
    slug = `${baseSlug}-${suffix}`
  }

  return slug
}

export async function getPlayerBySlug(slug: string) {
  return prisma.player.findUnique({
    where: { slug },
    include: {
      category: true,
      tournament: true,
      user: true,
    },
  })
}

export async function getPlayersByTournament(tournamentId: string) {
  return prisma.player.findMany({
    where: { tournamentId },
    include: {
      category: { select: { id: true, name: true } },
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ category: { order: 'asc' } }, { firstName: 'asc' }, { lastName: 'asc' }],
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

export async function updatePlayerName(playerId: string, firstName: string, lastName: string) {
  const first = firstName.trim()
  const last = lastName.trim()
  if (!first) throw new Error('Nombre requerido')

  const slug = await generateUniquePlayerSlug(first, last, playerId)

  return prisma.player.update({
    where: { id: playerId },
    data: { firstName: first, lastName: last, slug },
  })
}

export async function createPlayer(data: {
  tournamentId: string
  categoryId: string
  firstName: string
  lastName: string
  email?: string
  whatsappNumber?: string
}) {
  // If email provided and user exists, link
  let userId: string | undefined
  if (data.email) {
    const user = await prisma.user.findUnique({ where: { email: data.email } })
    if (user) userId = user.id
  }

  const slug = await generateUniquePlayerSlug(data.firstName, data.lastName)

  return prisma.player.create({
    data: {
      ...data,
      slug,
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

export async function getActivePlayerSlugByUserId(userId: string): Promise<string | null> {
  const player = await prisma.player.findFirst({
    where: { userId, isActive: true },
    select: { slug: true },
  })
  return player?.slug ?? null
}

export async function getPlayerMapByCategory(categoryId: string): Promise<Map<string, string>> {
  const players = await prisma.player.findMany({
    where: { categoryId, userId: { not: null } },
    select: { slug: true, userId: true },
  })
  return new Map(players.map((p) => [p.userId!, p.slug]))
}
