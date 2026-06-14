import { prisma } from '@/lib/prisma'
import { fullName } from '@/lib/format-name'
import { blobUrl } from '@/lib/blob-url'
import { subDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { TIMEZONE } from '@/lib/constants'
import { previousWeekRangeUY, weekRangeUY, monthRangeUY } from '@/lib/date-utils'
import { eloPreview } from '@/lib/elo'
import { formatMatchScore } from '@/lib/format-score'
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
  /** Puesto actual en La Escalera (#N). */
  position: number | null
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
  const [slugMap, standing] = await Promise.all([
    getPlayerSlugsByUserIds([winnerId]),
    getMemberStanding(winnerId),
  ])
  return {
    userId: winnerId,
    name: m ? fullName(m.user.firstName, m.user.lastName) || 'Jugador' : 'Jugador',
    image: blobUrl(m?.user.image) ?? null,
    playerSlug: slugMap.get(winnerId) ?? null,
    position: standing?.position ?? null,
    netGain,
    matchesPlayed: played.get(winnerId) ?? 0,
  }
}

// ============================================================================
// Racha de victorias (fueguitos)
// ============================================================================

/**
 * Racha actual de victorias consecutivas en partidos de escalera por usuario:
 * cuenta hacia atrás desde su último partido jugado hasta la primera derrota.
 * Una victoria por walkover cuenta (el winnerId es el ganador); perder por
 * walkover corta la racha. Orden cronológico por `scheduledAt` (la fecha del
 * slot, con fallback a `playedAt`/`createdAt`). Solo incluye usuarios con racha ≥ 1.
 */
export async function getLadderWinStreaks(): Promise<Map<string, number>> {
  const ladder = await getLadder()
  if (!ladder) return new Map()

  const matches = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: 'PLAYED' },
    select: {
      player1Id: true,
      player2Id: true,
      scheduledAt: true,
      playedAt: true,
      createdAt: true,
      result: { select: { winnerId: true } },
    },
  })

  // Historial cronológico por usuario: {at, won}.
  const byUser = new Map<string, { at: number; won: boolean }[]>()
  for (const m of matches) {
    if (!m.result) continue
    const at = (m.scheduledAt ?? m.playedAt ?? m.createdAt).getTime()
    for (const uid of [m.player1Id, m.player2Id]) {
      if (!uid) continue
      const list = byUser.get(uid) ?? []
      list.push({ at, won: m.result.winnerId === uid })
      byUser.set(uid, list)
    }
  }

  const streaks = new Map<string, number>()
  for (const [uid, list] of byUser) {
    list.sort((a, b) => a.at - b.at)
    let streak = 0
    for (let i = list.length - 1; i >= 0 && list[i].won; i--) streak++
    if (streak > 0) streaks.set(uid, streak)
  }
  return streaks
}

/** Racha actual de victorias consecutivas de un solo usuario (ver getLadderWinStreaks). */
export async function getLadderWinStreak(userId: string): Promise<number> {
  const ladder = await getLadder()
  if (!ladder) return 0
  const matches = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: 'PLAYED', OR: [{ player1Id: userId }, { player2Id: userId }] },
    select: { scheduledAt: true, playedAt: true, createdAt: true, result: { select: { winnerId: true } } },
  })
  const list = matches
    .filter((m) => m.result)
    .map((m) => ({ at: (m.scheduledAt ?? m.playedAt ?? m.createdAt).getTime(), won: m.result!.winnerId === userId }))
    .sort((a, b) => a.at - b.at)
  let streak = 0
  for (let i = list.length - 1; i >= 0 && list[i].won; i--) streak++
  return streak
}

// ============================================================================
// Partidos jugados en el mes corriente (pelotitas)
// ============================================================================

/** Un partido de escalera jugado este mes, desde la perspectiva de un jugador. */
export interface MonthlyMatchDetail {
  matchId: string
  rivalName: string
  rivalSlug: string | null
  /** Puesto actual del rival en La Escalera (#N). */
  rivalRank: number | null
  won: boolean
  walkover: boolean
  /** Marcador desde la perspectiva del jugador (sus games primero), o 'W/O'. */
  score: string
  playedAt: Date
}

type ScoreFields = {
  set1Player1: number
  set1Player2: number
  tb1Player1: number | null
  tb1Player2: number | null
  set2Player1: number | null
  set2Player2: number | null
  tb2Player1: number | null
  tb2Player2: number | null
  superTbPlayer1: number | null
  superTbPlayer2: number | null
}

/** Marcador desde la perspectiva de un jugador: sus games primero (espeja si es player2). */
function scoreFromPerspective(r: ScoreFields, viewerIsP1: boolean): string {
  if (viewerIsP1) return formatMatchScore(r)
  return formatMatchScore({
    set1Player1: r.set1Player2,
    set1Player2: r.set1Player1,
    tb1Player1: r.tb1Player2,
    tb1Player2: r.tb1Player1,
    set2Player1: r.set2Player2,
    set2Player2: r.set2Player1,
    tb2Player1: r.tb2Player2,
    tb2Player2: r.tb2Player1,
    superTbPlayer1: r.superTbPlayer2,
    superTbPlayer2: r.superTbPlayer1,
  })
}

/**
 * Partidos de escalera jugados por cada usuario en el mes calendario UY corriente,
 * con el detalle de cada uno (rival, ganó/perdió, marcador desde su perspectiva).
 * Mismo criterio de inclusión que el cierre mensual (ladder-cron-service): PLAYED por
 * `playedAt` dentro del mes y el ausente del walkover NO cuenta (el ganador por
 * walkover sí) — así la cantidad de "pelotitas" == largo de la lista. Map<userId,
 * partidos> ordenados del más reciente al más viejo; solo usuarios con ≥ 1.
 */
export async function getLadderMonthlyMatches(): Promise<Map<string, MonthlyMatchDetail[]>> {
  const ladder = await getLadder()
  if (!ladder) return new Map()

  const nowUY = toZonedTime(new Date(), TIMEZONE)
  const { startUTC, endUTC } = monthRangeUY(nowUY.getFullYear(), nowUY.getMonth() + 1)

  const matches = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: 'PLAYED', playedAt: { gte: startUTC, lte: endUTC } },
    orderBy: { playedAt: 'desc' },
    select: {
      id: true,
      playedAt: true,
      player1Id: true,
      player2Id: true,
      player1: { select: { firstName: true, lastName: true } },
      player2: { select: { firstName: true, lastName: true } },
      result: {
        select: {
          walkover: true,
          winnerId: true,
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
        },
      },
    },
  })

  const userIds = [
    ...new Set(matches.flatMap((m) => [m.player1Id, m.player2Id]).filter((id): id is string => !!id)),
  ]
  const [slugMap, ranking] = await Promise.all([getPlayerSlugsByUserIds(userIds), getLadderRanking()])
  const positionByUser = new Map(ranking.map((e) => [e.userId, e.position]))

  const byUser = new Map<string, MonthlyMatchDetail[]>()
  for (const m of matches) {
    if (!m.result || !m.player1Id || !m.player2Id) continue
    const isWalkover = m.result.walkover
    // playedAt no es null: el where filtra por playedAt dentro del mes.
    const playedAt = m.playedAt as Date
    for (const viewerIsP1 of [true, false]) {
      const uid = viewerIsP1 ? m.player1Id : m.player2Id
      const rivalId = viewerIsP1 ? m.player2Id : m.player1Id
      // El ausente del walkover no suma (igual criterio que el conteo y el cierre).
      if (isWalkover && uid !== m.result.winnerId) continue
      const rival = viewerIsP1 ? m.player2 : m.player1
      const list = byUser.get(uid) ?? []
      list.push({
        matchId: m.id,
        rivalName: fullName(rival?.firstName ?? null, rival?.lastName ?? null) || 'Jugador',
        rivalSlug: slugMap.get(rivalId) ?? null,
        rivalRank: positionByUser.get(rivalId) ?? null,
        won: m.result.winnerId === uid,
        walkover: isWalkover,
        score: isWalkover ? 'W/O' : scoreFromPerspective(m.result, viewerIsP1),
        playedAt,
      })
      byUser.set(uid, list)
    }
  }
  return byUser
}

// ============================================================================
// Variación de puntos del mes (flecha al lado del puntaje)
// ============================================================================

/**
 * Variación NETA de puntos (Rating) por usuario en sus Partidos de escalera del
 * mes calendario UY corriente: suma de los `delta` de `RatingHistory` reason MATCH
 * cuyo partido tiene `playedAt` dentro del mes (mismo universo que las "pelotitas",
 * ver getLadderMonthlyMatches). Una victoria por walkover suma 0. Las penalizaciones
 * por inactividad NO cuentan (solo partidos). Map<userId, neto>; incluye también los
 * netos en 0 (el componente no dibuja flecha para 0).
 */
export async function getMonthlyRatingDeltas(): Promise<Map<string, number>> {
  const ladder = await getLadder()
  if (!ladder) return new Map()

  const nowUY = toZonedTime(new Date(), TIMEZONE)
  const { startUTC, endUTC } = monthRangeUY(nowUY.getFullYear(), nowUY.getMonth() + 1)

  const rows = await prisma.ratingHistory.findMany({
    where: {
      reason: 'MATCH',
      member: { ladderId: ladder.id },
      match: { status: 'PLAYED', playedAt: { gte: startUTC, lte: endUTC } },
    },
    select: { delta: true, member: { select: { userId: true } } },
  })

  const net = new Map<string, number>()
  for (const r of rows) {
    net.set(r.member.userId, (net.get(r.member.userId) ?? 0) + r.delta)
  }
  return net
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
  /** Puesto en La Escalera (#N) de cada jugador. */
  player1Rank: number | null
  player2Rank: number | null
  importance: number
  /** Puntos en juego del retador (player1): +gana / pierde (solo no jugados). */
  preview: { ifWin: number; ifLose: number } | null
  /** Delta de Rating aplicado a cada jugador (solo jugados). */
  resultDeltas: { player1: number | null; player2: number | null } | null
  /** Reserva pendiente de cancha+horario (solo PENDING). */
  reservation: { scheduledAt: Date; courtNumber: number } | null
}

/**
 * Partidos de escalera destacados: todo reto aceptado por venir (PENDING + CONFIRMED,
 * con o sin reserva — aparecen ni bien existen) + jugados recientes (el resultado sigue
 * visible 2 días después de la fecha del partido, luego sale). Ordenados por Importancia
 * (suma de los Rating de ambos jugadores), top 7.
 */
export async function getFeaturedMatches(): Promise<FeaturedMatch[]> {
  const ladder = await getLadder()
  if (!ladder) return []

  // Los jugados quedan destacados hasta 2 días después de la fecha del partido.
  const playedSince = subDays(new Date(), 2)
  const [matches, ranking] = await Promise.all([
    prisma.match.findMany({
      where: {
        ladderId: ladder.id,
        OR: [
          // Por venir: todo reto aceptado, tenga o no reserva/fecha aún.
          { status: { in: ['PENDING', 'CONFIRMED'] } },
          // Jugados recientes: visibles 2 días tras la fecha del partido.
          { status: 'PLAYED', scheduledAt: { gte: playedSince } },
        ],
      },
      select: featuredSelect,
    }),
    getLadderRanking(),
  ])
  if (matches.length === 0) return []

  const ratingByUser = new Map(ranking.map((e) => [e.userId, e.rating]))
  const positionByUser = new Map(ranking.map((e) => [e.userId, e.position]))
  const userIds = matches.flatMap((m) => [m.player1Id, m.player2Id]).filter((id): id is string => !!id)
  const pendingIds = matches.filter((m) => m.status === 'PENDING').map((m) => m.id)
  const [slugMap, deltaMap, reservations] = await Promise.all([
    getPlayerSlugsByUserIds(userIds),
    getLadderResultDeltas(matches),
    getReservationsByMatchIds(pendingIds),
  ])
  const reservationMap = new Map(
    reservations.map((r) => [r.matchId, { scheduledAt: r.scheduledAt, courtNumber: r.courtNumber }])
  )

  return matches
    .map((m) => {
      const r1 = ratingByUser.get(m.player1Id ?? '')
      const r2 = ratingByUser.get(m.player2Id ?? '')
      return {
        match: { ...m, category: null },
        player1Slug: m.player1Id ? slugMap.get(m.player1Id) ?? null : null,
        player2Slug: m.player2Id ? slugMap.get(m.player2Id) ?? null : null,
        player1Rank: m.player1Id ? positionByUser.get(m.player1Id) ?? null : null,
        player2Rank: m.player2Id ? positionByUser.get(m.player2Id) ?? null : null,
        importance: (r1 ?? 0) + (r2 ?? 0),
        preview: r1 != null && r2 != null ? eloPreview(ladder.kFactor, r1, r2) : null,
        resultDeltas: deltaMap.get(m.id) ?? null,
        reservation: m.status === 'PENDING' ? reservationMap.get(m.id) ?? null : null,
      }
    })
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 7)
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
  /** Puesto en La Escalera (#N) de cada jugador. */
  player1Rank: number | null
  player2Rank: number | null
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
  const [slugMap, deltaMap, previewMap, reservations, ranking] = await Promise.all([
    getPlayerSlugsByUserIds(userIds),
    getLadderResultDeltas(matches),
    getLadderChallengerPreviews(matches),
    getReservationsByMatchIds(pendingIds),
    getLadderRanking(),
  ])
  const reservationMap = new Map(
    reservations.map((r) => [r.matchId, { scheduledAt: r.scheduledAt, courtNumber: r.courtNumber }])
  )
  const positionByUser = new Map(ranking.map((e) => [e.userId, e.position]))

  const toItem = (m: FeaturedRow): LadderMatchItem => ({
    match: { ...m, category: null },
    player1Slug: m.player1Id ? slugMap.get(m.player1Id) ?? null : null,
    player2Slug: m.player2Id ? slugMap.get(m.player2Id) ?? null : null,
    player1Rank: m.player1Id ? positionByUser.get(m.player1Id) ?? null : null,
    player2Rank: m.player2Id ? positionByUser.get(m.player2Id) ?? null : null,
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
// Movimiento de puesto de la semana
// ============================================================================

/**
 * Δ de posición por miembro desde el inicio de la semana en curso UY (lunes 00:00;
 * positivo = subió, negativo = bajó). Reconstruye el Rating al inicio de la semana
 * restando los deltas de la semana (no se guarda historial de posiciones). Los
 * miembros con alta posterior al inicio de la semana no llevan entrada (sin
 * baseline). Se reinicia cada lunes. Siempre en vivo (se recalcula por request).
 */
export async function getWeeklyPositionMovement(): Promise<Map<string, number>> {
  const ladder = await getLadder()
  if (!ladder) return new Map()

  const { startUTC } = weekRangeUY()

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

  const deltaSinceWeekStart = new Map<string, number>()
  for (const h of history) {
    deltaSinceWeekStart.set(h.member.userId, (deltaSinceWeekStart.get(h.member.userId) ?? 0) + h.delta)
  }

  // Mismo orden que getLadderRanking: rating desc, joinedAt asc, id asc.
  const tieBreak = (a: { joinedAt: Date; id: string }, b: { joinedAt: Date; id: string }) =>
    a.joinedAt.getTime() - b.joinedAt.getTime() || a.id.localeCompare(b.id)

  const currentRanked = [...members].sort((a, b) => b.rating - a.rating || tieBreak(a, b))
  const currentPos = new Map(currentRanked.map((m, i) => [m.userId, i + 1]))

  // Baseline: solo los miembros que ya existían al inicio de la semana, rankeados
  // por su rating reconstruido a esa fecha.
  const baseline = members
    .filter((m) => m.joinedAt < startUTC)
    .map((m) => ({ ...m, startRating: m.rating - (deltaSinceWeekStart.get(m.userId) ?? 0) }))
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

/**
 * Curvas de Rating de todos los miembros de La Escalera en una sola query (batch de
 * getRatingEvolution). Para mostrar la gráfica de cada jugador en la tabla del ranking
 * (Dialog al tocar los puntos). Map<userId, RatingPoint[]> en orden cronológico.
 */
export async function getLadderRatingEvolutions(): Promise<Map<string, RatingPoint[]>> {
  const ladder = await getLadder()
  if (!ladder) return new Map()
  const members = await prisma.ladderMember.findMany({
    where: { ladderId: ladder.id },
    select: {
      userId: true,
      ratingHistory: { orderBy: { createdAt: 'asc' }, select: { createdAt: true, ratingAfter: true } },
    },
  })
  return new Map(
    members.map((m) => [m.userId, m.ratingHistory.map((r) => ({ at: r.createdAt, rating: r.ratingAfter }))])
  )
}
