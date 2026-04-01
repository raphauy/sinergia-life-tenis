import { prisma } from '@/lib/prisma'
import { blobUrl } from '@/lib/blob-url'
import { fullName } from '@/lib/format-name'
import type { Match, MatchResult } from '@prisma/client'

export interface RankingEntry {
  position: number
  player: {
    id: string
    slug: string
    name: string
    image: string | null
  }
  pj: number // partidos jugados
  pg: number // partidos ganados
  gamesFor: number
  gamesAgainst: number
  gamesDiff: number
  points: number // TODO: lógica real de puntos (pendiente Mati)
}

type MatchWithResult = Match & { result: MatchResult | null }

function computeRanking(
  players: { id: string; slug: string; userId: string; displayName: string; image: string | null }[],
  matches: MatchWithResult[]
): RankingEntry[] {
  const entries: RankingEntry[] = players.map((p) => {
    const userId = p.userId

    const playerMatches = matches.filter(
      (m) => m.player1Id === userId || m.player2Id === userId
    )

    let pg = 0
    let gamesFor = 0
    let gamesAgainst = 0

    for (const m of playerMatches) {
      if (!m.result) continue
      const isPlayer1 = m.player1Id === userId
      const won = m.result.winnerId === userId

      if (won) pg++

      // Count games (not super tiebreak)
      const sets: [number, number][] = [
        [m.result.set1Player1, m.result.set1Player2],
      ]
      if (m.result.set2Player1 != null && m.result.set2Player2 != null) {
        sets.push([m.result.set2Player1, m.result.set2Player2])
      }
      if (m.result.set3Player1 != null && m.result.set3Player2 != null) {
        sets.push([m.result.set3Player1, m.result.set3Player2])
      }

      for (const [p1Games, p2Games] of sets) {
        if (isPlayer1) {
          gamesFor += p1Games
          gamesAgainst += p2Games
        } else {
          gamesFor += p2Games
          gamesAgainst += p1Games
        }
      }
    }

    return {
      position: 0,
      player: {
        id: p.id,
        slug: p.slug,
        name: p.displayName,
        image: blobUrl(p.image) || null,
      },
      pj: playerMatches.filter((m) => m.result).length,
      pg,
      gamesFor,
      gamesAgainst,
      gamesDiff: gamesFor - gamesAgainst,
      points: pg, // TODO: lógica real de puntos
    }
  })

  // Sort by points desc, then pg desc, then games diff desc, then name asc
  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.pg !== a.pg) return b.pg - a.pg
    if (b.gamesDiff !== a.gamesDiff) return b.gamesDiff - a.gamesDiff
    return a.player.name.localeCompare(b.player.name)
  })

  // Assign positions
  entries.forEach((e, i) => {
    e.position = i + 1
  })

  return entries
}

export async function getRankingByCategory(categoryId: string): Promise<RankingEntry[]> {
  const players = await prisma.player.findMany({
    where: { categoryId, isActive: true, userId: { not: null } },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, image: true } },
    },
  })

  const matches = await prisma.match.findMany({
    where: { categoryId, status: 'PLAYED' },
    include: { result: true },
  })

  return computeRanking(
    players
      .filter((p) => p.user)
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        userId: p.userId!,
        displayName: fullName(p.user!.firstName, p.user!.lastName) || fullName(p.firstName, p.lastName),
        image: p.user!.image,
      })),
    matches
  )
}

export async function getRankingByGroup(groupId: string): Promise<RankingEntry[]> {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { categoryId: true },
  })

  const players = await prisma.player.findMany({
    where: { groupId, isActive: true, userId: { not: null } },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, image: true } },
    },
  })

  const matches = await prisma.match.findMany({
    where: { groupId, categoryId: group.categoryId, status: 'PLAYED' },
    include: { result: true },
  })

  return computeRanking(
    players
      .filter((p) => p.user)
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        userId: p.userId!,
        displayName: fullName(p.user!.firstName, p.user!.lastName) || fullName(p.firstName, p.lastName),
        image: p.user!.image,
      })),
    matches
  )
}
