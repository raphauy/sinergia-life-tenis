import { prisma } from '@/lib/prisma'

export async function getGroupsByCategory(categoryId: string) {
  const groups = await prisma.group.findMany({
    where: { categoryId },
    include: {
      players: {
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, userId: true, email: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      },
    },
    orderBy: { number: 'asc' },
  })

  // Count matches per group (excluding cancelled)
  const counts = await Promise.all(
    groups.map((g) =>
      Promise.all([
        prisma.match.count({ where: { groupId: g.id, status: { not: 'CANCELLED' } } }),
        prisma.match.count({ where: { groupId: g.id, status: 'PENDING' } }),
      ])
    )
  )

  return groups.map((g, i) => ({
    ...g,
    matchCount: counts[i][0],
    pendingMatchCount: counts[i][1],
  }))
}

export async function getGroupById(groupId: string) {
  return prisma.group.findUnique({
    where: { id: groupId },
    include: {
      category: { select: { id: true, name: true, tournamentId: true } },
      players: {
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, userId: true, email: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      },
      _count: { select: { matches: true } },
    },
  })
}

export async function createGroup(categoryId: string) {
  const maxGroup = await prisma.group.findFirst({
    where: { categoryId },
    orderBy: { number: 'desc' },
    select: { number: true },
  })

  return prisma.group.create({
    data: {
      categoryId,
      number: (maxGroup?.number ?? 0) + 1,
    },
  })
}

export async function deleteGroup(groupId: string) {
  return prisma.group.delete({ where: { id: groupId } })
}

/** Returns count of PENDING matches that involve players being removed from the group */
export async function getAffectedPendingMatches(groupId: string, newPlayerIds: string[]) {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      players: {
        where: { isActive: true, userId: { not: null } },
        select: { id: true, userId: true },
      },
    },
  })

  // Find userIds of players being removed
  const newPlayerIdSet = new Set(newPlayerIds)
  const removedUserIds = group.players
    .filter((p) => !newPlayerIdSet.has(p.id))
    .map((p) => p.userId!)

  if (removedUserIds.length === 0) return 0

  return prisma.match.count({
    where: {
      groupId,
      status: 'PENDING',
      OR: [
        { player1Id: { in: removedUserIds } },
        { player2Id: { in: removedUserIds } },
      ],
    },
  })
}

export async function setGroupPlayers(groupId: string, playerIds: string[], cancelPending: boolean = false) {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { categoryId: true },
  })

  // Validate all players belong to the same category
  if (playerIds.length > 0) {
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, categoryId: true },
    })
    const invalid = players.filter((p) => p.categoryId !== group.categoryId)
    if (invalid.length > 0) {
      throw new Error('Todos los jugadores deben pertenecer a la misma categoría del grupo')
    }
  }

  // Find userIds of players being removed (for cancellation)
  let removedUserIds: string[] = []
  if (cancelPending) {
    const currentPlayers = await prisma.player.findMany({
      where: { groupId, isActive: true, userId: { not: null } },
      select: { id: true, userId: true },
    })
    const newIdSet = new Set(playerIds)
    removedUserIds = currentPlayers
      .filter((p) => !newIdSet.has(p.id))
      .map((p) => p.userId!)
  }

  // Build operations array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = []

  if (cancelPending && removedUserIds.length > 0) {
    ops.push(
      prisma.match.updateMany({
        where: {
          groupId,
          status: 'PENDING',
          OR: [
            { player1Id: { in: removedUserIds } },
            { player2Id: { in: removedUserIds } },
          ],
        },
        data: { status: 'CANCELLED' },
      })
    )
  }

  ops.push(
    prisma.player.updateMany({
      where: { groupId },
      data: { groupId: null },
    })
  )

  if (playerIds.length > 0) {
    ops.push(
      prisma.player.updateMany({
        where: { id: { in: playerIds } },
        data: { groupId },
      })
    )
  }

  await prisma.$transaction(ops)
}

export async function deletePendingMatches(groupId: string) {
  const result = await prisma.match.deleteMany({
    where: { groupId, status: 'PENDING' },
  })
  return result.count
}

export async function generateRoundRobinMatches(groupId: string) {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      category: { select: { id: true, tournamentId: true } },
      players: {
        where: { isActive: true, userId: { not: null } },
        select: { userId: true },
      },
    },
  })

  const userIds = group.players.map((p) => p.userId!)

  if (userIds.length < 2) {
    throw new Error('Se necesitan al menos 2 jugadores con cuenta vinculada para generar partidos')
  }

  // Check existing non-cancelled matches in this group to avoid duplicates
  const existingMatches = await prisma.match.findMany({
    where: {
      groupId,
      status: { not: 'CANCELLED' },
    },
    select: { player1Id: true, player2Id: true },
  })

  const existingPairs = new Set(
    existingMatches.map((m) => [m.player1Id, m.player2Id].sort().join(':'))
  )

  // Generate all unique pairs
  const matchesToCreate: { player1Id: string; player2Id: string }[] = []
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      const key = [userIds[i], userIds[j]].sort().join(':')
      if (!existingPairs.has(key)) {
        matchesToCreate.push({ player1Id: userIds[i], player2Id: userIds[j] })
      }
    }
  }

  if (matchesToCreate.length === 0) {
    return 0
  }

  const created = await prisma.$transaction(
    matchesToCreate.map((pair) =>
      prisma.match.create({
        data: {
          tournamentId: group.category.tournamentId,
          categoryId: group.category.id,
          groupId,
          player1Id: pair.player1Id,
          player2Id: pair.player2Id,
          status: 'PENDING',
        },
      })
    )
  )

  return created.length
}
