import { prisma } from '@/lib/prisma'
import type { Prisma, TournamentModality } from '@prisma/client'

/**
 * Parejas de un torneo de dobles (ADR 0002). En `Match.player1Id/player2Id` y en
 * `MatchResult.winnerId` va el `User` del capitán (representante) de cada pareja; el
 * compañero se deriva por `DoublesPair`. Este archivo es el ÚNICO lugar que resuelve
 * esa asimetría: el resto de la app pregunta acá por la pareja de un lado, de un
 * usuario o por slug, y nunca lee `captainOf`/`partnerOf` a mano.
 */

type Tx = Prisma.TransactionClient

const memberSelect = {
  id: true,
  slug: true,
  firstName: true,
  lastName: true,
  userId: true,
  user: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true, image: true } },
} as const

const pairInclude = {
  captain: { select: memberSelect },
  partner: { select: memberSelect },
} as const

type PairRow = Prisma.DoublesPairGetPayload<{ include: typeof pairInclude }>

/** Una persona de la pareja: su `Player` de la categoría Dobles + su `User`. */
export interface PairMember {
  playerId: string
  /** Slug del Player de dobles: no se linkea (el perfil es el slug canónico). */
  playerSlug: string
  userId: string
  firstName: string | null
  lastName: string | null
  /** Nombre para mostrar del User ("Rapha C."); null = nombre completo. */
  displayName: string | null
  email: string
  image: string | null
}

export interface DoublesPair {
  id: string
  categoryId: string
  /** Slug del perfil de la pareja (/pareja/[slug]), único en la categoría. */
  slug: string
  /** Representante: su `User` es el que va en el `Match`. Invisible en la UI. */
  captain: PairMember
  partner: PairMember
}

export interface MatchPairs {
  side1: DoublesPair | null
  side2: DoublesPair | null
}

/**
 * Integrante de una pareja sin datos de contacto: lo único que puede llegar a un
 * componente de cliente (`email?: never` hace que pasar un `PairMember` no compile).
 * Convertir con `toPublicPairs` (src/lib/pair-display.ts).
 */
export type PublicPairMember = Omit<PairMember, 'email'> & { email?: never }

export interface PublicDoublesPair extends Omit<DoublesPair, 'captain' | 'partner'> {
  captain: PublicPairMember
  partner: PublicPairMember
}

export interface PublicMatchPairs {
  side1: PublicDoublesPair | null
  side2: PublicDoublesPair | null
}

/** Lo mínimo de un partido para saber de qué lado está cada pareja. */
export interface MatchSidesRef {
  categoryId: string | null
  player1Id: string | null
  player2Id: string | null
  /** null en partidos de escalera. */
  tournament: { modality: TournamentModality } | null
}

function toMember(p: PairRow['captain']): PairMember | null {
  if (!p.userId || !p.user) return null
  return {
    playerId: p.id,
    playerSlug: p.slug,
    userId: p.userId,
    firstName: p.user.firstName ?? p.firstName,
    lastName: p.user.lastName ?? p.lastName,
    displayName: p.user.displayName,
    email: p.user.email,
    image: p.user.image,
  }
}

/** Una pareja con alguno de los dos sin cuenta vinculada no participa de partidos: se descarta. */
function toPair(row: PairRow): DoublesPair | null {
  const captain = toMember(row.captain)
  const partner = toMember(row.partner)
  if (!captain || !partner) return null
  return { id: row.id, categoryId: row.categoryId, slug: row.slug, captain, partner }
}

export function isDoublesMatch(match: Pick<MatchSidesRef, 'tournament'>): boolean {
  return match.tournament?.modality === 'DOUBLES'
}

/** La pareja de la categoría en la que está el usuario (como capitán o compañero), o null. */
export async function getPairForUserInCategory(
  categoryId: string,
  userId: string,
  tx?: Tx
): Promise<DoublesPair | null> {
  const client = tx ?? prisma
  const row = await client.doublesPair.findFirst({
    where: {
      categoryId,
      OR: [{ captain: { userId } }, { partner: { userId } }],
    },
    include: pairInclude,
  })
  return row ? toPair(row) : null
}

/** Todas las parejas (válidas) de una categoría de dobles. */
export async function getPairsByCategory(categoryId: string, tx?: Tx): Promise<DoublesPair[]> {
  const client = tx ?? prisma
  const rows = await client.doublesPair.findMany({ where: { categoryId }, include: pairInclude })
  return rows.map(toPair).filter((p): p is DoublesPair => p !== null)
}

/** La pareja por su slug, dentro de una categoría (id) o de un torneo (slug del torneo). */
export async function getPairBySlug(
  scope: { categoryId: string } | { tournamentSlug: string },
  slug: string
): Promise<DoublesPair | null> {
  const row = await prisma.doublesPair.findFirst({
    where: {
      slug,
      ...('categoryId' in scope
        ? { categoryId: scope.categoryId }
        : { category: { tournament: { slug: scope.tournamentSlug } } }),
    },
    include: pairInclude,
  })
  return row ? toPair(row) : null
}

/** Clave capitán+categoría para indexar parejas por lado de partido. */
function sideKey(categoryId: string, captainUserId: string) {
  return `${categoryId}:${captainUserId}`
}

/**
 * Las parejas de cada lado para varios partidos en una sola consulta. Solo los
 * partidos de dobles traen `MatchPairs`; los de singles y escalera, null.
 */
export async function getPairsForMatches<T extends MatchSidesRef & { id: string }>(
  matches: T[],
  tx?: Tx
): Promise<Map<string, MatchPairs>> {
  const client = tx ?? prisma
  const doubles = matches.filter((m) => isDoublesMatch(m) && m.categoryId)
  const result = new Map<string, MatchPairs>()
  if (doubles.length === 0) return result

  const categoryIds = [...new Set(doubles.map((m) => m.categoryId!))]
  const captainIds = [
    ...new Set(doubles.flatMap((m) => [m.player1Id, m.player2Id]).filter((id): id is string => !!id)),
  ]
  const rows = captainIds.length
    ? await client.doublesPair.findMany({
        where: { categoryId: { in: categoryIds }, captain: { userId: { in: captainIds } } },
        include: pairInclude,
      })
    : []

  const byCaptain = new Map<string, DoublesPair>()
  for (const row of rows) {
    const pair = toPair(row)
    if (pair) byCaptain.set(sideKey(pair.categoryId, pair.captain.userId), pair)
  }

  for (const m of doubles) {
    const lookup = (userId: string | null) =>
      userId ? byCaptain.get(sideKey(m.categoryId!, userId)) ?? null : null
    result.set(m.id, { side1: lookup(m.player1Id), side2: lookup(m.player2Id) })
  }
  return result
}

/** La pareja de cada lado de un partido (`player1Id/player2Id` son los capitanes). */
export async function getPairsForMatchSides(
  match: MatchSidesRef & { id: string },
  tx?: Tx
): Promise<MatchPairs> {
  const map = await getPairsForMatches([match], tx)
  return map.get(match.id) ?? { side1: null, side2: null }
}

export async function getPairsForMatch(matchId: string): Promise<MatchPairs> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      categoryId: true,
      player1Id: true,
      player2Id: true,
      tournament: { select: { modality: true } },
    },
  })
  if (!match) return { side1: null, side2: null }
  return getPairsForMatchSides(match)
}

/** Los dos integrantes en orden capitán, compañero (el orden en que el club mandó la pareja). */
export function pairMembers(pair: DoublesPair): [PairMember, PairMember] {
  return [pair.captain, pair.partner]
}

/** Apellido para el nombre de la pareja: el apellido completo, o la última palabra del nombre. */
function surname(m: PairMember): string {
  const last = m.lastName?.trim()
  if (last) return last
  const words = (m.firstName ?? '').trim().split(/\s+/).filter(Boolean)
  return words[words.length - 1] ?? m.email.split('@')[0]
}

/** "Pérez / García" (capitán primero). */
export function pairName(pair: DoublesPair): string {
  return pairMembers(pair).map(surname).join(' / ')
}


/**
 * De qué lado del partido juega el usuario: 1, 2 o null si no juega. En singles y
 * escalera es player1/player2; en dobles cuenta también el compañero de cada lado.
 */
export async function getUserSideInMatch(
  match: MatchSidesRef & { id: string },
  userId: string,
  tx?: Tx
): Promise<1 | 2 | null> {
  if (match.player1Id === userId) return 1
  if (match.player2Id === userId) return 2
  if (!isDoublesMatch(match) || !match.categoryId) return null
  const pair = await getPairForUserInCategory(match.categoryId, userId, tx)
  if (!pair) return null
  if (pair.captain.userId === match.player1Id) return 1
  if (pair.captain.userId === match.player2Id) return 2
  return null
}

/** El usuario juega el partido (singles: es un lado; dobles: está en una de las dos parejas). */
export async function isUserInMatch(
  match: MatchSidesRef & { id: string },
  userId: string,
  tx?: Tx
): Promise<boolean> {
  return (await getUserSideInMatch(match, userId, tx)) !== null
}

/**
 * Los `User` de los capitanes cuyos partidos ve el usuario como compañero, con la
 * categoría (para que el lookup de partidos no mezcle torneos). Vacío si no es
 * compañero de nadie.
 */
export async function getCaptainsForPartner(
  userId: string
): Promise<{ categoryId: string; captainUserId: string }[]> {
  const rows = await prisma.doublesPair.findMany({
    where: { partner: { userId } },
    select: { categoryId: true, captain: { select: { userId: true } } },
  })
  return rows
    .filter((r) => r.captain.userId)
    .map((r) => ({ categoryId: r.categoryId, captainUserId: r.captain.userId! }))
}

/** Si la categoría es de un torneo de dobles. */
export async function isDoublesCategory(categoryId: string, tx?: Tx): Promise<boolean> {
  const client = tx ?? prisma
  const category = await client.tournamentCategory.findUnique({
    where: { id: categoryId },
    select: { tournament: { select: { modality: true } } },
  })
  return category?.tournament.modality === 'DOUBLES'
}

/** Corta con `message` si la categoría es de un torneo de dobles (lo administra el script de carga). */
export async function assertCategoryNotDoubles(categoryId: string, message: string): Promise<void> {
  if (await isDoublesCategory(categoryId)) throw new Error(message)
}

/** Torneo de una pareja, para el perfil de pareja y la sección Dobles del perfil. */
export interface PairTournament {
  id: string
  name: string
  slug: string
  startDate: Date
  featuredOnHome: boolean
}

export interface PairWithTournament {
  pair: DoublesPair
  tournament: PairTournament
}

const pairTournamentSelect = {
  category: {
    select: {
      tournament: { select: { id: true, name: true, slug: true, startDate: true, featuredOnHome: true } },
    },
  },
} as const

/**
 * La pareja del perfil público `/pareja/[slug]` (la ruta no lleva torneo). El slug es
 * único por categoría, así que puede repetirse entre torneos: gana el torneo en
 * portada y, si no, el torneo de dobles más reciente.
 */
export async function getPairByPublicSlug(slug: string): Promise<PairWithTournament | null> {
  const rows = await prisma.doublesPair.findMany({
    where: { slug, category: { tournament: { modality: 'DOUBLES' } } },
    include: { ...pairInclude, ...pairTournamentSelect },
    orderBy: [{ category: { tournament: { startDate: 'desc' } } }, { createdAt: 'desc' }],
  })
  const ordered = [
    ...rows.filter((r) => r.category.tournament.featuredOnHome),
    ...rows.filter((r) => !r.category.tournament.featuredOnHome),
  ]
  for (const row of ordered) {
    const pair = toPair(row)
    if (pair) return { pair, tournament: row.category.tournament }
  }
  return null
}

/** Las parejas de dobles en las que juega el usuario, del torneo más reciente al más viejo. */
export async function getPairsForUser(userId: string): Promise<PairWithTournament[]> {
  const rows = await prisma.doublesPair.findMany({
    where: {
      category: { tournament: { modality: 'DOUBLES' } },
      OR: [{ captain: { userId } }, { partner: { userId } }],
    },
    include: { ...pairInclude, ...pairTournamentSelect },
    orderBy: [{ category: { tournament: { startDate: 'desc' } } }, { createdAt: 'desc' }],
  })
  return rows.flatMap((row) => {
    const pair = toPair(row)
    return pair ? [{ pair, tournament: row.category.tournament }] : []
  })
}
