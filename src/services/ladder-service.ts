import { prisma } from '@/lib/prisma'
import { blobUrl } from '@/lib/blob-url'
import { fullName } from '@/lib/format-name'
import { computeRanking } from './ranking-service'
import { getBracketByCategory } from './bracket-service'
import { getPlayerSlugsByUserIds } from './player-service'
import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

export const LADDER_SLUG = 'la-escalera'
export const LADDER_NAME = 'La Escalera'
// Defaults del seed (coinciden con los @default de Ladder en el schema; usados
// para el preview en vivo de la pantalla de siembra antes de que exista la fila).
export const SEED_BASE_RATING = 1500
export const SEED_STEP = 20

// ============================================================================
// Lectura
// ============================================================================

export async function getLadder(tx?: Tx) {
  const client = tx ?? prisma
  return client.ladder.findFirst({ where: { isActive: true } })
}

export interface LadderEntry {
  position: number
  userId: string
  name: string
  image: string | null
  rating: number
  playerSlug: string | null
}

export async function getLadderRanking(): Promise<LadderEntry[]> {
  const ladder = await getLadder()
  if (!ladder) return []

  const members = await prisma.ladderMember.findMany({
    where: { ladderId: ladder.id, isActive: true },
    // `id` final como desempate determinista: los miembros sembrados comparten
    // joinedAt (CURRENT_TIMESTAMP se congela por transacción), así que sin esto el
    // orden entre ratings iguales sería no determinista.
    orderBy: [{ rating: 'desc' }, { joinedAt: 'asc' }, { id: 'asc' }],
    include: { user: { select: { id: true, firstName: true, lastName: true, image: true } } },
  })

  const slugMap = await getPlayerSlugsByUserIds(members.map((m) => m.userId))

  return members.map((m, i) => ({
    position: i + 1,
    userId: m.userId,
    name: fullName(m.user.firstName, m.user.lastName) || 'Jugador',
    image: blobUrl(m.user.image) || null,
    rating: m.rating,
    playerSlug: slugMap.get(m.userId) ?? null,
  }))
}

export async function getMember(userId: string, tx?: Tx) {
  const client = tx ?? prisma
  const ladder = await getLadder(tx)
  if (!ladder) return null
  return client.ladderMember.findUnique({
    where: { ladderId_userId: { ladderId: ladder.id, userId } },
  })
}

export async function hasLadderMatches(ladderId: string, tx?: Tx): Promise<boolean> {
  const client = tx ?? prisma
  const count = await client.match.count({ where: { ladderId } })
  return count > 0
}

// ============================================================================
// Siembra (seed) — placement desde el resultado del 1er torneo
// ============================================================================

export type SeedSource = 'FINAL' | 'SEMIFINAL' | 'QUARTERFINAL' | 'GROUP'

export interface SeedProposalItem {
  playerId: string
  userId: string | null
  firstName: string
  lastName: string
  displayName: string
  image: string | null
  email: string | null
  categoryName: string
  source: SeedSource
}

/**
 * Propone el orden 1..N de la escalera derivando el resultado final de cada
 * categoría del torneo: 1º campeón, 2º finalista, 3-4 perdedores de semis,
 * 5-8 perdedores de cuartos (empates de ronda y "resto" por ranking de grupos),
 * categorías concatenadas por su `order` (A→B→C). Incluye a TODOS los Players
 * (también retirados y sin User). El admin reordena/quita antes de bloquear.
 */
export async function proposeSeedOrder(tournamentId: string): Promise<SeedProposalItem[]> {
  const categories = await prisma.tournamentCategory.findMany({
    where: { tournamentId },
    orderBy: { order: 'asc' },
  })

  const result: SeedProposalItem[] = []
  for (const cat of categories) {
    const items = await proposeCategoryOrder(cat.id, cat.name)
    result.push(...items)
  }
  return result
}

type SeedPlayer = Prisma.PlayerGetPayload<{
  include: { user: { select: { id: true; firstName: true; lastName: true; image: true } } }
}>

function toItem(p: SeedPlayer, categoryName: string, source: SeedSource): SeedProposalItem {
  return {
    playerId: p.id,
    userId: p.userId,
    firstName: p.firstName,
    lastName: p.lastName,
    displayName:
      fullName(p.user?.firstName ?? p.firstName, p.user?.lastName ?? p.lastName) ||
      fullName(p.firstName, p.lastName) ||
      'Jugador',
    image: blobUrl(p.user?.image) || null,
    email: p.email ?? null,
    categoryName,
    source,
  }
}

async function proposeCategoryOrder(categoryId: string, categoryName: string): Promise<SeedProposalItem[]> {
  const players = await prisma.player.findMany({
    where: { categoryId },
    include: { user: { select: { id: true, firstName: true, lastName: true, image: true } } },
  })

  const groupMatches = await prisma.match.findMany({
    where: { categoryId, status: 'PLAYED', stage: 'GROUP' },
    include: { result: true },
  })

  // Clave sintética: userId real, o playerId si no tiene cuenta (nunca matchea
  // un partido → stats 0 → queda al fondo del ranking de grupos).
  const keyOf = (p: SeedPlayer) => p.userId ?? p.id

  const ranking = computeRanking(
    players.map((p) => ({
      id: p.id,
      slug: p.slug,
      userId: keyOf(p),
      displayName: toItem(p, categoryName, 'GROUP').displayName,
      image: p.user?.image ?? null,
    })),
    groupMatches
  )

  // Récords incompletos al fondo: un jugador que disputó menos partidos que el
  // máximo de SU grupo (p. ej. un partido que no se jugó) queda debajo de los
  // que completaron su grupo. Se compara contra el máximo del propio grupo —no
  // un pj global— para no penalizar grupos legítimamente más chicos (cat. C).
  const groupByKey = new Map(players.map((p) => [keyOf(p), p.groupId]))
  const pjByKey = new Map(ranking.map((e) => [e.userId, e.pj]))
  const groupMaxPj = new Map<string, number>()
  for (const e of ranking) {
    const gid = groupByKey.get(e.userId)
    if (gid) groupMaxPj.set(gid, Math.max(groupMaxPj.get(gid) ?? 0, e.pj))
  }
  const isIncomplete = (key: string) => {
    const gid = groupByKey.get(key)
    if (!gid) return false
    return (pjByKey.get(key) ?? 0) < (groupMaxPj.get(gid) ?? 0)
  }
  // Orden estable: completos primero (en orden de performance), incompletos al final.
  const seedRanking = [...ranking].sort(
    (a, b) => Number(isIncomplete(a.userId)) - Number(isIncomplete(b.userId))
  )
  const rankIndex = new Map(seedRanking.map((e, i) => [e.userId, i]))
  const playerByUserId = new Map(players.filter((p) => p.userId).map((p) => [p.userId as string, p]))

  const bracket = await getBracketByCategory(categoryId)
  const loserOf = (m: {
    player1Id: string | null
    player2Id: string | null
    result: { winnerId: string } | null
  }): string | null => {
    if (!m.result) return null
    return m.result.winnerId === m.player1Id ? m.player2Id : m.player1Id
  }
  const byGroupRank = (a: string, b: string) =>
    (rankIndex.get(a) ?? Infinity) - (rankIndex.get(b) ?? Infinity)

  const placed: string[] = []
  if (bracket.final?.result) {
    placed.push(bracket.final.result.winnerId)
    const finalist = loserOf(bracket.final)
    if (finalist) placed.push(finalist)
  }
  const sfLosers = bracket.semifinals.map(loserOf).filter((x): x is string => !!x).sort(byGroupRank)
  placed.push(...sfLosers)
  const qfLosers = bracket.quarterfinals.map(loserOf).filter((x): x is string => !!x).sort(byGroupRank)
  placed.push(...qfLosers)

  const placedSet = new Set(placed)
  const sourceOf = (uid: string): SeedSource => {
    if (bracket.final?.result && (bracket.final.result.winnerId === uid || loserOf(bracket.final) === uid)) return 'FINAL'
    if (sfLosers.includes(uid)) return 'SEMIFINAL'
    if (qfLosers.includes(uid)) return 'QUARTERFINAL'
    return 'GROUP'
  }

  const items: SeedProposalItem[] = []
  for (const uid of placed) {
    const p = playerByUserId.get(uid)
    if (p) items.push(toItem(p, categoryName, sourceOf(uid)))
  }
  const rest = players
    .filter((p) => !(p.userId && placedSet.has(p.userId)))
    .sort((a, b) => byGroupRank(keyOf(a), keyOf(b)))
  for (const p of rest) items.push(toItem(p, categoryName, 'GROUP'))

  return items
}

// ============================================================================
// Commit / reset de la siembra
// ============================================================================

export interface SeedCommitItem {
  playerId: string
  userId: string | null
  email: string | null
  firstName: string
  lastName: string
}

/**
 * Crea la escalera (si no existe) y siembra los miembros en el orden dado, en
 * una sola transacción: resuelve/crea el User de cada uno, asigna rating
 * (seedBaseRating − seedStep·índice) y registra el historial inicial (SEED).
 */
export async function commitSeed(items: SeedCommitItem[]): Promise<{ ladderId: string; membersCreated: number }> {
  if (items.length === 0) throw new Error('No hay jugadores para sembrar')

  // Abortar temprano si ya está sembrada (antes de tocar cuentas).
  const current = await prisma.ladder.findFirst({ where: { isActive: true } })
  if (current && (await prisma.ladderMember.count({ where: { ladderId: current.id } })) > 0) {
    throw new Error('La escalera ya está sembrada. Usá "Re-sembrar" para rehacerla.')
  }

  // Pre-chequeo de duplicados obvios (misma cuenta o mismo email repetido) ANTES
  // de mutar, para no dejar User creados a medias ante un error del admin.
  const seenUser = new Set<string>()
  const seenEmail = new Set<string>()
  for (const item of items) {
    if (item.userId) {
      if (seenUser.has(item.userId)) throw new Error('Hay un jugador repetido en la lista. Quitá el duplicado.')
      seenUser.add(item.userId)
    }
    const email = item.email?.trim().toLowerCase()
    if (email) {
      if (seenEmail.has(email)) throw new Error('Hay dos jugadores con el mismo email. Revisá la lista.')
      seenEmail.add(email)
    }
  }

  // Resolver/crear los User FUERA de la transacción: cada uno es idempotente por
  // email, así la transacción queda corta y no expira en serverless (la versión
  // anterior hacía ~41×varias queries dentro de la tx y excedía el límite de 5s).
  const resolved: string[] = []
  for (const item of items) {
    let userId = item.userId
    if (!userId) {
      const email = item.email?.trim()
      if (!email) throw new Error(`Falta email para ${item.firstName} ${item.lastName}`)
      const existingUser = await prisma.user.findUnique({ where: { email } })
      userId = existingUser
        ? existingUser.id
        : (
            await prisma.user.create({
              data: { email, firstName: item.firstName, lastName: item.lastName, role: 'PLAYER' },
            })
          ).id
      await prisma.player.update({ where: { id: item.playerId }, data: { userId } })
    }
    resolved.push(userId)
  }

  // Defensa: misma cuenta dos veces rompería el @@unique([ladderId, userId]).
  const seen = new Set<string>()
  for (const userId of resolved) {
    if (seen.has(userId)) {
      throw new Error('Hay un jugador repetido en la lista (misma cuenta dos veces). Quitá el duplicado.')
    }
    seen.add(userId)
  }

  // Transacción corta: ladder + members con historial SEED anidado (1 query c/u).
  return prisma.$transaction(
    async (tx) => {
      let ladder = await tx.ladder.findFirst({ where: { isActive: true } })
      if (!ladder) {
        ladder = await tx.ladder.create({ data: { name: LADDER_NAME, slug: LADDER_SLUG } })
      }
      if ((await tx.ladderMember.count({ where: { ladderId: ladder.id } })) > 0) {
        throw new Error('La escalera ya está sembrada. Usá "Re-sembrar" para rehacerla.')
      }

      for (let i = 0; i < resolved.length; i++) {
        const rating = ladder.seedBaseRating - ladder.seedStep * i
        await tx.ladderMember.create({
          data: {
            ladderId: ladder.id,
            userId: resolved[i],
            rating,
            ratingHistory: {
              create: { reason: 'SEED', ratingBefore: rating, ratingAfter: rating, delta: 0 },
            },
          },
        })
      }

      return { ladderId: ladder.id, membersCreated: resolved.length }
    },
    { timeout: 30000, maxWait: 10000 }
  )
}

/** Borra todos los miembros (y su historial por cascade). Solo si no hay partidos. */
export async function resetSeed(): Promise<void> {
  const ladder = await getLadder()
  if (!ladder) return
  if (await hasLadderMatches(ladder.id)) {
    throw new Error('No se puede re-sembrar: la escalera ya tiene partidos.')
  }
  await prisma.ladderMember.deleteMany({ where: { ladderId: ladder.id } })
}
