import { prisma } from '@/lib/prisma'
import { fullName } from '@/lib/format-name'
import { blobUrl } from '@/lib/blob-url'
import { toZonedTime } from 'date-fns-tz'
import { TIMEZONE } from '@/lib/constants'
import { monthRangeUY, weekRangeUY, previousWeekRangeUY } from '@/lib/date-utils'
import { eloPreview } from '@/lib/elo'
import { getLadder, getLadderRanking } from './ladder-service'
import { getPlayerSlugsByUserIds } from './player-service'
import { getReservationsByMatchIds } from './reservation-service'
import type { Prisma } from '@prisma/client'

// ============================================================================
// Jugador de la semana
// ============================================================================

export interface PlayerOfTheWeek {
  userId: string
  name: string
  image: string | null
  playerSlug: string | null
  /** Ganancia neta de Rating en partidos de la semana (suma de deltas MATCH). */
  netGain: number
  matchesPlayed: number
}

/**
 * Miembro con mayor ganancia NETA de Rating en partidos de la semana recién
 * cerrada (lunes–domingo UY anterior). Atribuye por `scheduledAt` (la fecha del
 * slot), no por cuándo se cargó el resultado, así un partido del sábado cuenta en
 * su semana aunque el resultado entre el lunes. Walkover → 0 (no ayuda).
 * Desempate: más partidos jugados → menor Rating actual. null si nadie sumó neto.
 */
export async function getPlayerOfTheWeek(): Promise<PlayerOfTheWeek | null> {
  const ladder = await getLadder()
  if (!ladder) return null

  const { startUTC, endUTC } = previousWeekRangeUY()
  const matches = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: 'PLAYED', scheduledAt: { gte: startUTC, lte: endUTC } },
    select: {
      player1Id: true,
      player2Id: true,
      result: { select: { walkover: true, winnerId: true } },
      ratingHistory: {
        where: { reason: 'MATCH' },
        select: { delta: true, member: { select: { userId: true } } },
      },
    },
  })
  if (matches.length === 0) return null

  // Neto de Rating por jugador (desde RatingHistory MATCH) y partidos jugados
  // (mismo criterio de walkover que el cron: el ausente del walkover no suma).
  const net = new Map<string, number>()
  const played = new Map<string, number>()
  for (const m of matches) {
    for (const rh of m.ratingHistory) {
      net.set(rh.member.userId, (net.get(rh.member.userId) ?? 0) + rh.delta)
    }
    const isWalkover = m.result?.walkover ?? false
    for (const uid of [m.player1Id, m.player2Id]) {
      if (!uid) continue
      if (isWalkover && uid !== m.result?.winnerId) continue
      played.set(uid, (played.get(uid) ?? 0) + 1)
    }
  }

  const candidates = [...net.entries()].filter(([, d]) => d > 0)
  if (candidates.length === 0) return null

  const ids = candidates.map(([uid]) => uid)
  const members = await prisma.ladderMember.findMany({
    where: { ladderId: ladder.id, userId: { in: ids } },
    select: { userId: true, rating: true, user: { select: { firstName: true, lastName: true, image: true } } },
  })
  const memberMap = new Map(members.map((m) => [m.userId, m]))

  candidates.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1] // mayor neto
    const pa = played.get(a[0]) ?? 0
    const pb = played.get(b[0]) ?? 0
    if (pb !== pa) return pb - pa // más partidos
    return (memberMap.get(a[0])?.rating ?? 0) - (memberMap.get(b[0])?.rating ?? 0) // menor rating
  })

  const [winnerId, netGain] = candidates[0]
  const m = memberMap.get(winnerId)
  const slugMap = await getPlayerSlugsByUserIds([winnerId])
  return {
    userId: winnerId,
    name: m ? fullName(m.user.firstName, m.user.lastName) || 'Jugador' : 'Jugador',
    image: blobUrl(m?.user.image) ?? null,
    playerSlug: slugMap.get(winnerId) ?? null,
    netGain,
    matchesPlayed: played.get(winnerId) ?? 0,
  }
}

// ============================================================================
// Partidos destacados de la semana (home)
// ============================================================================

const featuredSelect = {
  id: true,
  status: true,
  stage: true,
  ladderId: true,
  scheduledAt: true,
  courtNumber: true,
  player1Id: true,
  player2Id: true,
  player1: { select: { firstName: true, lastName: true } },
  player2: { select: { firstName: true, lastName: true } },
  result: {
    select: {
      walkover: true,
      set1Player1: true,
      set1Player2: true,
      tb1Player1: true,
      tb1Player2: true,
      set2Player1: true,
      set2Player2: true,
      tb2Player1: true,
      tb2Player2: true,
      superTbPlayer1: true,
      superTbPlayer2: true,
      winnerId: true,
      photoUrl: true,
    },
  },
} satisfies Prisma.MatchSelect

type FeaturedRow = Prisma.MatchGetPayload<{ select: typeof featuredSelect }>

export interface FeaturedMatch {
  match: FeaturedRow & { category: null }
  player1Slug: string | null
  player2Slug: string | null
  importance: number
  /** Puntos en juego del retador (player1): +gana / pierde (solo no jugados). */
  preview: { ifWin: number; ifLose: number } | null
  /** Delta de Rating aplicado a cada jugador (solo jugados). */
  resultDeltas: { player1: number | null; player2: number | null } | null
}

/**
 * Partidos de escalera con `scheduledAt` en la semana corriente UY (CONFIRMED por
 * venir + PLAYED de la semana, que quedan visibles hasta el cierre), ordenados por
 * Importancia (suma de los Rating de ambos jugadores), top 5.
 */
export async function getFeaturedMatches(): Promise<FeaturedMatch[]> {
  const ladder = await getLadder()
  if (!ladder) return []

  const { startUTC, endUTC } = weekRangeUY()
  const [matches, ranking] = await Promise.all([
    prisma.match.findMany({
      where: {
        ladderId: ladder.id,
        status: { in: ['CONFIRMED', 'PLAYED'] },
        scheduledAt: { gte: startUTC, lte: endUTC },
      },
      select: featuredSelect,
    }),
    getLadderRanking(),
  ])
  if (matches.length === 0) return []

  const ratingByUser = new Map(ranking.map((e) => [e.userId, e.rating]))
  const userIds = matches.flatMap((m) => [m.player1Id, m.player2Id]).filter((id): id is string => !!id)
  const [slugMap, deltaMap] = await Promise.all([
    getPlayerSlugsByUserIds(userIds),
    getLadderResultDeltas(matches),
  ])

  return matches
    .map((m) => {
      const r1 = ratingByUser.get(m.player1Id ?? '')
      const r2 = ratingByUser.get(m.player2Id ?? '')
      return {
        match: { ...m, category: null },
        player1Slug: m.player1Id ? slugMap.get(m.player1Id) ?? null : null,
        player2Slug: m.player2Id ? slugMap.get(m.player2Id) ?? null : null,
        importance: (r1 ?? 0) + (r2 ?? 0),
        preview: r1 != null && r2 != null ? eloPreview(ladder.kFactor, r1, r2) : null,
        resultDeltas: deltaMap.get(m.id) ?? null,
      }
    })
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5)
}

/**
 * Delta de Rating aplicado a cada jugador en partidos de escalera JUGADOS (de
 * RatingHistory reason MATCH). Map<matchId, {player1, player2}>. Para mostrar en
 * las cards "cuánto ganó/perdió cada uno".
 */
export async function getLadderResultDeltas(
  matches: { id: string; ladderId: string | null; player1Id: string | null; player2Id: string | null; status: string }[]
): Promise<Map<string, { player1: number | null; player2: number | null }>> {
  const played = matches.filter((m) => m.ladderId && m.status === 'PLAYED')
  if (played.length === 0) return new Map()

  const rows = await prisma.ratingHistory.findMany({
    where: { reason: 'MATCH', matchId: { in: played.map((m) => m.id) } },
    select: { matchId: true, delta: true, member: { select: { userId: true } } },
  })
  const byMatch = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (!r.matchId) continue
    const inner = byMatch.get(r.matchId) ?? new Map<string, number>()
    inner.set(r.member.userId, r.delta)
    byMatch.set(r.matchId, inner)
  }

  const out = new Map<string, { player1: number | null; player2: number | null }>()
  for (const m of played) {
    const inner = byMatch.get(m.id)
    out.set(m.id, {
      player1: m.player1Id ? inner?.get(m.player1Id) ?? null : null,
      player2: m.player2Id ? inner?.get(m.player2Id) ?? null : null,
    })
  }
  return out
}

/**
 * Preview ELO del retador (player1) por partido de escalera, para mostrar "puntos
 * en juego" en las cards. Devuelve un Map<matchId, {ifWin, ifLose}>. Ignora
 * partidos que no sean de escalera o sin ambos jugadores.
 */
export async function getLadderChallengerPreviews(
  matches: { id: string; ladderId: string | null; player1Id: string | null; player2Id: string | null }[]
): Promise<Map<string, { ifWin: number; ifLose: number }>> {
  const ladderMatches = matches.filter((m) => m.ladderId && m.player1Id && m.player2Id)
  if (ladderMatches.length === 0) return new Map()
  const ladder = await getLadder()
  if (!ladder) return new Map()

  const userIds = [...new Set(ladderMatches.flatMap((m) => [m.player1Id!, m.player2Id!]))]
  const members = await prisma.ladderMember.findMany({
    where: { ladderId: ladder.id, userId: { in: userIds } },
    select: { userId: true, rating: true },
  })
  const ratingByUser = new Map(members.map((m) => [m.userId, m.rating]))

  const out = new Map<string, { ifWin: number; ifLose: number }>()
  for (const m of ladderMatches) {
    const r1 = ratingByUser.get(m.player1Id!)
    const r2 = ratingByUser.get(m.player2Id!)
    if (r1 == null || r2 == null) continue
    out.set(m.id, eloPreview(ladder.kFactor, r1, r2))
  }
  return out
}

// ============================================================================
// Todos los partidos de la escalera (vista pública de Partidos)
// ============================================================================

export interface LadderMatchItem {
  match: FeaturedRow & { category: null }
  player1Slug: string | null
  player2Slug: string | null
  /** Puntos en juego del retador (player1): +gana / pierde (solo no jugados). */
  preview: { ifWin: number; ifLose: number } | null
  /** Delta de Rating aplicado a cada jugador (solo jugados). */
  resultDeltas: { player1: number | null; player2: number | null } | null
  /** Reserva pendiente de cancha+horario (solo PENDING). */
  reservation: { scheduledAt: Date; courtNumber: number } | null
}

/**
 * Todos los partidos de escalera (excepto CANCELLED), separados en próximos
 * (PENDING + CONFIRMED) y resultados (PLAYED), con todo lo que la card necesita:
 * slug de cada jugador, preview ELO de los no jugados, delta de los jugados y la
 * reserva pendiente. Próximos: confirmados primero (por fecha), luego los pendientes
 * sin fecha. Resultados: del más reciente al más viejo por fecha del slot.
 */
export async function getLadderMatches(): Promise<{ upcoming: LadderMatchItem[]; played: LadderMatchItem[] }> {
  const ladder = await getLadder()
  if (!ladder) return { upcoming: [], played: [] }

  const matches = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: { in: ['PENDING', 'CONFIRMED', 'PLAYED'] } },
    select: featuredSelect,
  })
  if (matches.length === 0) return { upcoming: [], played: [] }

  const userIds = matches.flatMap((m) => [m.player1Id, m.player2Id]).filter((id): id is string => !!id)
  const pendingIds = matches.filter((m) => m.status === 'PENDING').map((m) => m.id)
  const [slugMap, deltaMap, previewMap, reservations] = await Promise.all([
    getPlayerSlugsByUserIds(userIds),
    getLadderResultDeltas(matches),
    getLadderChallengerPreviews(matches),
    getReservationsByMatchIds(pendingIds),
  ])
  const reservationMap = new Map(
    reservations.map((r) => [r.matchId, { scheduledAt: r.scheduledAt, courtNumber: r.courtNumber }])
  )

  const toItem = (m: FeaturedRow): LadderMatchItem => ({
    match: { ...m, category: null },
    player1Slug: m.player1Id ? slugMap.get(m.player1Id) ?? null : null,
    player2Slug: m.player2Id ? slugMap.get(m.player2Id) ?? null : null,
    preview: m.status !== 'PLAYED' ? previewMap.get(m.id) ?? null : null,
    resultDeltas: m.status === 'PLAYED' ? deltaMap.get(m.id) ?? null : null,
    reservation: m.status === 'PENDING' ? reservationMap.get(m.id) ?? null : null,
  })

  const upcoming = matches
    .filter((m) => m.status === 'PENDING' || m.status === 'CONFIRMED')
    .map(toItem)
    .sort((a, b) => {
      if (a.match.status !== b.match.status) return a.match.status === 'CONFIRMED' ? -1 : 1
      const ta = a.match.scheduledAt?.getTime() ?? Infinity
      const tb = b.match.scheduledAt?.getTime() ?? Infinity
      return ta - tb
    })
  const played = matches
    .filter((m) => m.status === 'PLAYED')
    .map(toItem)
    .sort((a, b) => (b.match.scheduledAt?.getTime() ?? 0) - (a.match.scheduledAt?.getTime() ?? 0))

  return { upcoming, played }
}

// ============================================================================
// Movimiento de puesto del mes
// ============================================================================

/**
 * Δ de posición por miembro desde el 1º del mes corriente UY (positivo = subió,
 * negativo = bajó). Reconstruye el Rating al inicio del mes restando los deltas
 * del mes (no se guarda historial de posiciones). Los miembros con alta posterior
 * al inicio del mes no llevan entrada (sin baseline).
 */
export async function getMonthlyPositionMovement(): Promise<Map<string, number>> {
  const ladder = await getLadder()
  if (!ladder) return new Map()

  const nowUY = toZonedTime(new Date(), TIMEZONE)
  const { startUTC } = monthRangeUY(nowUY.getFullYear(), nowUY.getMonth() + 1)

  const [members, history] = await Promise.all([
    prisma.ladderMember.findMany({
      where: { ladderId: ladder.id, isActive: true },
      select: { userId: true, rating: true, joinedAt: true, id: true },
    }),
    prisma.ratingHistory.findMany({
      where: { member: { ladderId: ladder.id }, createdAt: { gte: startUTC } },
      select: { delta: true, member: { select: { userId: true } } },
    }),
  ])

  const deltaSinceMonthStart = new Map<string, number>()
  for (const h of history) {
    deltaSinceMonthStart.set(h.member.userId, (deltaSinceMonthStart.get(h.member.userId) ?? 0) + h.delta)
  }

  // Mismo orden que getLadderRanking: rating desc, joinedAt asc, id asc.
  const tieBreak = (a: { joinedAt: Date; id: string }, b: { joinedAt: Date; id: string }) =>
    a.joinedAt.getTime() - b.joinedAt.getTime() || a.id.localeCompare(b.id)

  const currentRanked = [...members].sort((a, b) => b.rating - a.rating || tieBreak(a, b))
  const currentPos = new Map(currentRanked.map((m, i) => [m.userId, i + 1]))

  // Baseline: solo los miembros que ya existían al inicio del mes, rankeados por
  // su rating reconstruido a esa fecha.
  const baseline = members
    .filter((m) => m.joinedAt < startUTC)
    .map((m) => ({ ...m, startRating: m.rating - (deltaSinceMonthStart.get(m.userId) ?? 0) }))
    .sort((a, b) => b.startRating - a.startRating || tieBreak(a, b))
  const startPos = new Map(baseline.map((m, i) => [m.userId, i + 1]))

  const movement = new Map<string, number>()
  for (const [userId, start] of startPos) {
    const now = currentPos.get(userId)
    if (now != null) movement.set(userId, start - now) // + subió, − bajó
  }
  return movement
}

// ============================================================================
// Puesto/rating del miembro (perfil)
// ============================================================================

export interface MemberStanding {
  rating: number
  position: number
}

/** Rating y puesto del miembro en La Escalera (null si no es miembro). */
export async function getMemberStanding(userId: string): Promise<MemberStanding | null> {
  const ranking = await getLadderRanking()
  const entry = ranking.find((e) => e.userId === userId)
  return entry ? { rating: entry.rating, position: entry.position } : null
}

// ============================================================================
// Evolución de rating (gráfico del perfil)
// ============================================================================

export interface RatingPoint {
  at: Date
  rating: number
}

/** Curva de Rating del miembro en el tiempo (ratingAfter por evento, desde la siembra). */
export async function getRatingEvolution(userId: string): Promise<RatingPoint[]> {
  const ladder = await getLadder()
  if (!ladder) return []
  const member = await prisma.ladderMember.findUnique({
    where: { ladderId_userId: { ladderId: ladder.id, userId } },
    select: { id: true },
  })
  if (!member) return []
  const rows = await prisma.ratingHistory.findMany({
    where: { ladderMemberId: member.id },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true, ratingAfter: true },
  })
  return rows.map((r) => ({ at: r.createdAt, rating: r.ratingAfter }))
}
