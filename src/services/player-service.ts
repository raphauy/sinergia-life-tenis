import { prisma } from '@/lib/prisma'
import { generateSlug } from '@/lib/utils'
import { getGroupQualifiers, refreshBracketSlotsFromGroup } from './bracket-service'

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

export async function getPlayerSlugsByUserIds(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const players = await prisma.player.findMany({
    where: { userId: { in: userIds }, isActive: true },
    select: { slug: true, userId: true },
  })
  return new Map(players.map((p) => [p.userId!, p.slug]))
}

export async function getPlayerMapByCategory(categoryId: string): Promise<Map<string, string>> {
  const players = await prisma.player.findMany({
    where: { categoryId, userId: { not: null } },
    select: { slug: true, userId: true },
  })
  return new Map(players.map((p) => [p.userId!, p.slug]))
}

/**
 * Retires a player from the tournament:
 * - Marks withdrawnAt.
 * - Pending/Confirmed group matches are closed with walkover (6-0) in favor of the rival.
 * - Bracket slots that reference the withdrawn player are released so the next
 *   qualifier takes their place.
 *
 * Blocks if the player has a bracket match (QF/SF/F) already CONFIRMED or PLAYED —
 * in that case the admin must regenerate the bracket manually.
 */
export async function withdrawPlayer(playerId: string, reportedById: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { user: { select: { firstName: true, lastName: true } } },
  })
  if (!player) throw new Error('Jugador no encontrado')
  if (player.withdrawnAt) throw new Error('Este jugador ya está retirado')
  if (!player.userId) throw new Error('El jugador no tiene cuenta vinculada y no participa en partidos')

  const userId = player.userId
  const groupId = player.groupId

  // 1. Block withdrawal if the player has advanced bracket matches
  const conflictBracketMatches = await prisma.match.findMany({
    where: {
      stage: { not: 'GROUP' },
      OR: [{ player1Id: userId }, { player2Id: userId }],
      status: { in: ['CONFIRMED', 'PLAYED'] },
    },
    select: { id: true, stage: true, bracketPosition: true, status: true },
  })
  if (conflictBracketMatches.length > 0) {
    const labels = conflictBracketMatches.map((m) => {
      const stageLbl = m.stage === 'QUARTERFINAL' ? 'Cuartos' : m.stage === 'SEMIFINAL' ? 'Semifinal' : 'Final'
      return `${stageLbl}${m.bracketPosition != null && m.stage !== 'FINAL' ? ' ' + m.bracketPosition : ''} (${m.status.toLowerCase()})`
    }).join(', ')
    throw new Error(
      `No se puede retirar: el jugador tiene partidos de bracket en curso (${labels}). Regenerá el bracket primero.`,
    )
  }

  // 2. Capture current qualifier position in the group (if any), BEFORE marking withdrawn
  let sourcePosition: 1 | 2 | null = null
  if (groupId) {
    const q = await getGroupQualifiers(groupId)
    if (q.first === userId) sourcePosition = 1
    else if (q.second === userId) sourcePosition = 2
  }

  await prisma.$transaction(async (tx) => {
    // 3. Mark withdrawn
    await tx.player.update({
      where: { id: playerId },
      data: { withdrawnAt: new Date() },
    })

    // 4. Walkover pending/confirmed group matches
    const pendingGroupMatches = await tx.match.findMany({
      where: {
        groupId: groupId ?? undefined,
        stage: 'GROUP',
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [{ player1Id: userId }, { player2Id: userId }],
      },
      select: { id: true, player1Id: true, player2Id: true },
    })
    for (const m of pendingGroupMatches) {
      const rivalId = m.player1Id === userId ? m.player2Id : m.player1Id
      if (!rivalId) continue
      const player1IsRival = m.player1Id === rivalId
      await tx.matchResult.create({
        data: {
          matchId: m.id,
          reportedById,
          walkover: true,
          set1Player1: player1IsRival ? 6 : 0,
          set1Player2: player1IsRival ? 0 : 6,
          winnerId: rivalId,
        },
      })
      await tx.match.update({
        where: { id: m.id },
        data: { status: 'PLAYED', playedAt: new Date() },
      })
    }

    // 5. Release any bracket slot that had the withdrawn player directly assigned.
    //    Restore the source (groupId + position) so refreshBracketSlotsFromGroup
    //    can re-assign the replacement qualifier.
    if (groupId && sourcePosition) {
      await tx.match.updateMany({
        where: {
          stage: { not: 'GROUP' },
          categoryId: player.categoryId,
          player1Id: userId,
        },
        data: {
          player1Id: null,
          player1SourceGroupId: groupId,
          player1SourcePosition: sourcePosition,
        },
      })
      await tx.match.updateMany({
        where: {
          stage: { not: 'GROUP' },
          categoryId: player.categoryId,
          player2Id: userId,
        },
        data: {
          player2Id: null,
          player2SourceGroupId: groupId,
          player2SourcePosition: sourcePosition,
        },
      })
    }

    // 6. Recompute qualifiers and propagate to bracket slots with source
    if (groupId) {
      await refreshBracketSlotsFromGroup(groupId, tx)
    }
  })
}

/**
 * Reinstates a previously withdrawn player. Clears withdrawnAt and refreshes
 * bracket slots. Walkover match results created at withdrawal time are NOT
 * automatically reverted — admin must delete those results by hand if desired.
 */
export async function reinstatePlayer(playerId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } })
  if (!player) throw new Error('Jugador no encontrado')
  if (!player.withdrawnAt) throw new Error('Este jugador no está retirado')

  await prisma.$transaction(async (tx) => {
    await tx.player.update({
      where: { id: playerId },
      data: { withdrawnAt: null },
    })
    if (player.groupId) {
      await refreshBracketSlotsFromGroup(player.groupId, tx)
    }
  })
}
