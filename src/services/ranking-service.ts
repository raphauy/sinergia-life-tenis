import { prisma } from '@/lib/prisma'
import { blobUrl } from '@/lib/blob-url'
import { fullName } from '@/lib/format-name'
import type { Match, MatchResult, Prisma } from '@prisma/client'
import { getPairsByCategory, isDoublesCategory, pairName, type DoublesPair } from './doubles-pair-service'

type Tx = Prisma.TransactionClient

export interface RankingEntry {
  position: number
  player: {
    id: string
    slug: string
    name: string
    image: string | null
  }
  userId: string
  pj: number // partidos jugados
  pg: number // partidos ganados
  gamesFor: number
  gamesAgainst: number
  gamesDiff: number
  points: number // TODO: lógica real de puntos (pendiente Mati)
  /** Solo en dobles: la fila es la pareja (player/userId son los de su capitán). */
  pairSlug?: string
  /**
   * Solo en dobles: empate de 3 o más parejas (mismos ganados y diferencia de games) que
   * la tabla no puede resolver; su posición no está decidida hasta que el admin defina
   * el orden (`Group.tiebreakOrder`).
   */
  tied?: boolean
}

type MatchWithResult = Match & { result: MatchResult | null }

function headToHeadWinner(a: string, b: string, matches: MatchWithResult[]): string | null {
  for (const m of matches) {
    if (!m.result) continue
    const pair = [m.player1Id, m.player2Id]
    if (pair.includes(a) && pair.includes(b)) {
      return m.result.winnerId
    }
  }
  return null
}

export function computeRanking(
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
      userId,
      pj: playerMatches.filter((m) => m.result).length,
      pg,
      gamesFor,
      gamesAgainst,
      gamesDiff: gamesFor - gamesAgainst,
      points: pg, // TODO: lógica real de puntos
    }
  })

  // Sort by points desc, then pg desc, then games diff desc, then head-to-head, then name asc
  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.pg !== a.pg) return b.pg - a.pg
    if (b.gamesDiff !== a.gamesDiff) return b.gamesDiff - a.gamesDiff

    const h2h = headToHeadWinner(a.userId, b.userId, matches)
    if (h2h === a.userId) return -1
    if (h2h === b.userId) return 1

    return a.player.name.localeCompare(b.player.name)
  })

  // Assign positions
  entries.forEach((e, i) => {
    e.position = i + 1
  })

  return entries
}

type RankablePlayer = Prisma.PlayerGetPayload<{
  include: { user: { select: { id: true; firstName: true; lastName: true; image: true } } }
}>

/**
 * Arma la entrada de `computeRanking`. En dobles la fila es la pareja: se queda solo
 * con los capitanes (su `User` es el que va en los partidos) y el nombre es
 * "Pérez / García"; los compañeros, que también están en el grupo, no suman fila.
 */
async function rankPlayers(
  categoryId: string,
  players: RankablePlayer[],
  matches: MatchWithResult[],
  isDoubles: boolean,
  tx?: Tx,
  tiebreakOrder: string[] = []
): Promise<RankingEntry[]> {
  const withUser = players.filter((p) => p.user)

  if (!isDoubles) {
    return computeRanking(
      withUser.map((p) => ({
        id: p.id,
        slug: p.slug,
        userId: p.userId!,
        displayName: fullName(p.user!.firstName, p.user!.lastName) || fullName(p.firstName, p.lastName),
        image: p.user!.image,
      })),
      matches
    )
  }

  return rankDoublesPlayers(
    withUser.map((p) => ({ id: p.id, slug: p.slug, userId: p.userId! })),
    await getPairsByCategory(categoryId, tx),
    matches,
    tiebreakOrder
  )
}

/**
 * Tabla de un grupo de dobles en memoria: una fila por pareja, calculada sobre su
 * capitán (los compañeros no suman fila). `players` son los Player del grupo con
 * cuenta; `matches`, los de grupo jugados con resultado.
 *
 * Empate de 3 o más parejas en ganados y diferencia de games (en un grupo de 4 siempre
 * es un círculo: a le ganó a b, b a c, c a a): la tabla no lo puede resolver y acá no se
 * inventa un criterio. Quedan marcadas `tied` hasta que el admin defina el orden
 * (`tiebreakOrder`, userId de los capitanes); ahí se ordenan así y dejan de estar `tied`.
 */
export function rankDoublesPlayers(
  players: { id: string; slug: string; userId: string }[],
  pairs: DoublesPair[],
  matches: MatchWithResult[],
  tiebreakOrder: string[] = []
): RankingEntry[] {
  const pairByCaptain = new Map(pairs.map((pair) => [pair.captain.playerId, pair]))
  const entries = computeRanking(
    players
      .filter((p) => pairByCaptain.has(p.id))
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        userId: p.userId,
        displayName: pairName(pairByCaptain.get(p.id)!),
        image: null,
      })),
    matches
  )
  for (const e of entries) e.pairSlug = pairByCaptain.get(e.player.id)!.slug

  // Los empatados quedan contiguos (el orden es por puntos, ganados y diferencia).
  const sameKey = (a: RankingEntry, b: RankingEntry) =>
    a.points === b.points && a.pg === b.pg && a.gamesDiff === b.gamesDiff
  for (let start = 0; start < entries.length; ) {
    let end = start + 1
    while (end < entries.length && sameKey(entries[start], entries[end])) end++
    const cluster = entries.slice(start, end)
    // Sin partidos jugados todos "empatan" en cero: eso no es un empate a resolver.
    if (cluster.length >= 3 && cluster.some((e) => e.pj > 0)) {
      if (cluster.every((e) => tiebreakOrder.includes(e.userId))) {
        cluster.sort((a, b) => tiebreakOrder.indexOf(a.userId) - tiebreakOrder.indexOf(b.userId))
        entries.splice(start, cluster.length, ...cluster)
      } else {
        for (const e of cluster) e.tied = true
      }
    }
    start = end
  }
  entries.forEach((e, i) => {
    e.position = i + 1
  })
  return entries
}

export async function getRankingByCategory(categoryId: string, tx?: Tx): Promise<RankingEntry[]> {
  const client = tx ?? prisma
  const players = await client.player.findMany({
    where: { categoryId, isActive: true, withdrawnAt: null, userId: { not: null } },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, image: true } },
    },
  })

  const matches = await client.match.findMany({
    where: { categoryId, status: 'PLAYED', stage: 'GROUP' },
    include: { result: true },
  })

  return rankPlayers(categoryId, players, matches, await isDoublesCategory(categoryId, tx), tx)
}

export async function getRankingByGroup(groupId: string, tx?: Tx): Promise<RankingEntry[]> {
  const client = tx ?? prisma
  const group = await client.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { categoryId: true, tiebreakOrder: true, category: { select: { tournament: { select: { modality: true } } } } },
  })

  const players = await client.player.findMany({
    where: { groupId, isActive: true, withdrawnAt: null, userId: { not: null } },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, image: true } },
    },
  })

  const matches = await client.match.findMany({
    where: { groupId, categoryId: group.categoryId, status: 'PLAYED', stage: 'GROUP' },
    include: { result: true },
  })

  return rankPlayers(group.categoryId, players, matches, group.category.tournament.modality === 'DOUBLES', tx, group.tiebreakOrder)
}
