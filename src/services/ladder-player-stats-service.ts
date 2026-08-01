import { prisma } from '@/lib/prisma'
import { fullName } from '@/lib/format-name'
import { toZonedTime } from 'date-fns-tz'
import { TIMEZONE } from '@/lib/constants'
import { monthLabelUY } from '@/lib/date-utils'
import { getLadder, getLadderRanking } from './ladder-service'
import { getPlayerSlugsByUserIds } from './player-service'
import { scoreFromPerspective } from './ladder-stats-service'

// ============================================================================
// Estadísticas del jugador (tab Estadísticas del perfil)
//
// Universo: SOLO Partidos de escalera. Criterio de walkover en W-L, meses y
// rivales: el de las pelotitas (la victoria por W/O suma; el ausente no suma
// partido ni derrota). La racha usa el criterio del fueguito existente (la
// derrota por W/O ausente corta la racha).
// ============================================================================

export interface MonthActivity {
  year: number
  month: number // 1-12
  /** "mayo de 2026" (monthLabelUY). */
  label: string
  played: number
  /** Mes calendario UY en curso (no cierra todavía). */
  current: boolean
}

export interface RivalMatch {
  matchId: string
  won: boolean
  walkover: boolean
  /** Marcador desde la perspectiva del jugador (sus games primero), o 'W/O'. */
  score: string
  /** Fecha del partido (slot; fallback playedAt/createdAt). */
  date: Date
  /** Delta de Rating del jugador en ese partido (null si no hay fila MATCH). */
  delta: number | null
}

export interface RivalRecord {
  rivalUserId: string
  rivalName: string
  /** Puesto ACTUAL del rival en La Escalera (#N). */
  rivalRank: number | null
  wins: number
  losses: number
  /** Cruces del más reciente al más viejo. */
  matches: RivalMatch[]
}

export interface MemberLadderStats {
  wins: number
  losses: number
  /** wins + losses (universo pelotitas). */
  played: number
  /** 0-100 redondeado; null si no jugó. */
  winRate: number | null
  /** Máximo Rating histórico (todas las reasons de RatingHistory). */
  peakRating: number | null
  /** Racha de victorias consecutivas más larga de la historia. */
  longestStreak: number
  /**
   * Frecuencia: partidos jugados en meses UY COMPLETOS ÷ esos meses (el mes en
   * curso no divide). Si el alta fue este mes, no hay promedio: se informa el
   * total del mes en curso.
   */
  frequency:
    | { kind: 'average'; perMonth: number; completedMonths: number }
    | { kind: 'thisMonth'; total: number }
  /** Barras: desde el mes de alta hasta el corriente (marcado current). */
  months: MonthActivity[]
  /** Head-to-head por rival (≥1 cruce), por cantidad desc, empate más reciente. */
  rivals: RivalRecord[]
}

/** Año-mes UY de una fecha UTC. */
function yearMonthUY(date: Date): { year: number; month: number } {
  const z = toZonedTime(date, TIMEZONE)
  return { year: z.getFullYear(), month: z.getMonth() + 1 }
}

/**
 * Estadísticas de escalera de un miembro para los tiles y secciones de la tab
 * Estadísticas: W-L, win rate, pico de puntos, racha récord, frecuencia, barras
 * mensuales y rivales frecuentes. null si no hay escalera o no es miembro.
 */
export async function getMemberLadderStats(userId: string): Promise<MemberLadderStats | null> {
  const ladder = await getLadder()
  if (!ladder) return null
  const member = await prisma.ladderMember.findUnique({
    where: { ladderId_userId: { ladderId: ladder.id, userId } },
    select: { id: true, joinedAt: true },
  })
  if (!member) return null

  const [matches, history, ranking] = await Promise.all([
    prisma.match.findMany({
      where: { ladderId: ladder.id, status: 'PLAYED', OR: [{ player1Id: userId }, { player2Id: userId }] },
      select: {
        id: true,
        playedAt: true,
        scheduledAt: true,
        createdAt: true,
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
    }),
    prisma.ratingHistory.findMany({
      where: { ladderMemberId: member.id },
      select: { matchId: true, reason: true, delta: true, ratingAfter: true },
    }),
    getLadderRanking(),
  ])

  const withResult = matches.filter((m) => m.result && m.player1Id && m.player2Id)

  // Pico de puntos: máximo ratingAfter de todo el historial (incluye SEED/PENALTY).
  const peakRating = history.length > 0 ? Math.max(...history.map((h) => h.ratingAfter)) : null
  const deltaByMatch = new Map(
    history.filter((h) => h.reason === 'MATCH' && h.matchId).map((h) => [h.matchId as string, h.delta])
  )

  // Racha récord: mismo orden y criterio que el fueguito (getLadderWinStreak):
  // orden por fecha del slot y la derrota por W/O ausente también corta.
  const chrono = withResult
    .map((m) => ({
      at: (m.scheduledAt ?? m.playedAt ?? m.createdAt).getTime(),
      won: m.result!.winnerId === userId,
    }))
    .sort((a, b) => a.at - b.at)
  let longestStreak = 0
  let run = 0
  for (const e of chrono) {
    run = e.won ? run + 1 : 0
    if (run > longestStreak) longestStreak = run
  }

  // Universo pelotitas: el ausente del walkover queda fuera de W-L, meses y rivales.
  const counted = withResult.filter((m) => !(m.result!.walkover && m.result!.winnerId !== userId))
  const wins = counted.filter((m) => m.result!.winnerId === userId).length
  const losses = counted.length - wins
  const played = counted.length
  const winRate = played > 0 ? Math.round((wins / played) * 100) : null

  // Barras mensuales: del mes de alta al corriente, atribución por playedAt
  // (mismo criterio que las pelotitas y el cierre de mes).
  const join = yearMonthUY(member.joinedAt)
  const now = yearMonthUY(new Date())
  const months: MonthActivity[] = []
  const buckets = new Map<string, number>()
  for (const m of counted) {
    const { year, month } = yearMonthUY(m.playedAt ?? m.scheduledAt ?? m.createdAt)
    buckets.set(`${year}-${month}`, (buckets.get(`${year}-${month}`) ?? 0) + 1)
  }
  for (let y = join.year, mo = join.month; y < now.year || (y === now.year && mo <= now.month); ) {
    months.push({
      year: y,
      month: mo,
      label: monthLabelUY(y, mo),
      played: buckets.get(`${y}-${mo}`) ?? 0,
      current: y === now.year && mo === now.month,
    })
    mo++
    if (mo > 12) {
      mo = 1
      y++
    }
  }

  // Frecuencia: partidos de meses completos ÷ meses completos desde el alta.
  const completed = months.filter((m) => !m.current)
  const frequency: MemberLadderStats['frequency'] =
    completed.length > 0
      ? {
          kind: 'average',
          perMonth: completed.reduce((acc, m) => acc + m.played, 0) / completed.length,
          completedMonths: completed.length,
        }
      : { kind: 'thisMonth', total: months.at(-1)?.played ?? 0 }

  // Rivales frecuentes: agrupar por rival, cruces del más reciente al más viejo.
  const positionByUser = new Map(ranking.map((e) => [e.userId, e.position]))
  const byRival = new Map<string, RivalRecord>()
  const sortedRecent = [...counted].sort(
    (a, b) =>
      (b.scheduledAt ?? b.playedAt ?? b.createdAt).getTime() - (a.scheduledAt ?? a.playedAt ?? a.createdAt).getTime()
  )
  for (const m of sortedRecent) {
    const viewerIsP1 = m.player1Id === userId
    const rivalId = viewerIsP1 ? m.player2Id! : m.player1Id!
    const rival = viewerIsP1 ? m.player2 : m.player1
    const won = m.result!.winnerId === userId
    let rec = byRival.get(rivalId)
    if (!rec) {
      rec = {
        rivalUserId: rivalId,
        rivalName: fullName(rival?.firstName ?? null, rival?.lastName ?? null) || 'Jugador',
        rivalRank: positionByUser.get(rivalId) ?? null,
        wins: 0,
        losses: 0,
        matches: [],
      }
      byRival.set(rivalId, rec)
    }
    if (won) rec.wins++
    else rec.losses++
    rec.matches.push({
      matchId: m.id,
      won,
      walkover: m.result!.walkover,
      score: m.result!.walkover ? 'W/O' : scoreFromPerspective(m.result!, viewerIsP1),
      date: m.scheduledAt ?? m.playedAt ?? m.createdAt,
      delta: deltaByMatch.get(m.id) ?? null,
    })
  }
  // Por cantidad de cruces desc; empate → el del cruce más reciente primero.
  const rivals = [...byRival.values()].sort(
    (a, b) =>
      b.matches.length - a.matches.length || b.matches[0].date.getTime() - a.matches[0].date.getTime()
  )

  return { wins, losses, played, winRate, peakRating, longestStreak, frequency, months, rivals }
}

// ============================================================================
// Replay de puestos: mejor puesto histórico + mejor victoria
// ============================================================================

export interface BestWin {
  matchId: string
  rivalName: string
  rivalSlug: string | null
  /** Puesto del rival al momento de jugar (antes de aplicar el partido). */
  rivalPositionAtTime: number
  score: string
  date: Date
  /** Puntos ganados en ese partido. */
  delta: number | null
}

export interface MemberPositionHistory {
  /** Mejor puesto histórico (mínimo del replay). null si nunca entró al standing. */
  bestPosition: number | null
  /** Victoria (no W/O) contra el rival mejor rankeado al momento. Empate → la más reciente. */
  bestWin: BestWin | null
}

/**
 * Reconstruye la historia de puestos replayando el RatingHistory COMPLETO de la
 * escalera (no se guarda historial de posiciones). Un miembro entra al standing
 * con su fila SEED; las filas de un mismo partido se aplican atómicamente (para
 * no muestrear estados intermedios). Con ~50 miembros es barato.
 *
 * Limitaciones aceptadas:
 * - Usa el set ACTUAL de miembros activos (mismo criterio que getLadderRanking y
 *   getWeeklyPositionMovement), sin reconstruir activaciones/desactivaciones.
 * - Editar un resultado reescribe las 2 filas del partido in situ (recalcMatchElo,
 *   delta local sin replay), así que los `ratingAfter` posteriores quedan
 *   desfasados: los puestos reconstruidos alrededor de una edición son aproximados.
 * - Las filas SEED comparten `createdAt` (misma transacción): su orden depende del
 *   desempate por id (cuid); funciona porque la siembra inserta de mayor a menor
 *   rating y el standing completo post-siembra no depende del orden interno.
 */
export async function getMemberPositionHistory(userId: string): Promise<MemberPositionHistory> {
  const empty: MemberPositionHistory = { bestPosition: null, bestWin: null }
  const ladder = await getLadder()
  if (!ladder) return empty

  const [members, rows, myMatches] = await Promise.all([
    prisma.ladderMember.findMany({
      where: { ladderId: ladder.id, isActive: true },
      select: { id: true, userId: true, joinedAt: true },
    }),
    prisma.ratingHistory.findMany({
      where: { member: { ladderId: ladder.id, isActive: true } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { ladderMemberId: true, matchId: true, ratingAfter: true },
    }),
    prisma.match.findMany({
      where: { ladderId: ladder.id, status: 'PLAYED', OR: [{ player1Id: userId }, { player2Id: userId }] },
      select: {
        id: true,
        scheduledAt: true,
        playedAt: true,
        createdAt: true,
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
    }),
  ])
  if (rows.length === 0) return empty

  const memberById = new Map(members.map((m) => [m.id, m]))
  const me = members.find((m) => m.userId === userId)

  // Victorias reales (no W/O) del usuario, con lo que la card necesita.
  const winByMatch = new Map(
    myMatches
      .filter((m) => m.result && !m.result.walkover && m.result.winnerId === userId && m.player1Id && m.player2Id)
      .map((m) => {
        const viewerIsP1 = m.player1Id === userId
        const rival = viewerIsP1 ? m.player2 : m.player1
        return [
          m.id,
          {
            rivalUserId: viewerIsP1 ? m.player2Id! : m.player1Id!,
            rivalName: fullName(rival?.firstName ?? null, rival?.lastName ?? null) || 'Jugador',
            score: scoreFromPerspective(m.result!, viewerIsP1),
            date: m.scheduledAt ?? m.playedAt ?? m.createdAt,
          },
        ] as const
      })
  )

  // Standing en vivo: rating por miembro (presente = ya entró con su SEED).
  const ratings = new Map<string, number>()
  // Mismo tie-break que getLadderRanking: rating desc, joinedAt asc, id asc.
  const positionOf = (memberId: string): number | null => {
    if (!ratings.has(memberId)) return null
    const standing = [...ratings.entries()].sort(([ida, ra], [idb, rb]) => {
      if (rb !== ra) return rb - ra
      const a = memberById.get(ida)!
      const b = memberById.get(idb)!
      return a.joinedAt.getTime() - b.joinedAt.getTime() || a.id.localeCompare(b.id)
    })
    const idx = standing.findIndex(([id]) => id === memberId)
    return idx === -1 ? null : idx + 1
  }

  let bestPosition: number | null = null
  const winsAtTime: { matchId: string; rivalPos: number; date: Date }[] = []
  const seenMatches = new Set<string>()

  // Batches: filas consecutivas del mismo matchId se aplican juntas (las dos filas
  // de un partido — o de un recálculo por edición — nacen en la misma transacción).
  let i = 0
  while (i < rows.length) {
    const row = rows[i]
    const batch = [row]
    if (row.matchId) {
      while (i + 1 < rows.length && rows[i + 1].matchId === row.matchId) batch.push(rows[++i])
    }
    i++

    // Antes de aplicar la PRIMERA tanda de un partido ganado por el usuario:
    // puesto del rival y propio al momento de jugar.
    if (row.matchId && !seenMatches.has(row.matchId)) {
      seenMatches.add(row.matchId)
      const win = winByMatch.get(row.matchId)
      if (win) {
        const rivalMember = members.find((m) => m.userId === win.rivalUserId)
        const rivalPos = rivalMember ? positionOf(rivalMember.id) : null
        if (rivalPos != null) {
          winsAtTime.push({ matchId: row.matchId, rivalPos, date: win.date })
        }
      }
    }

    // Defensivo: ignorar filas de miembros fuera del set (p.ej. desactivado entre queries).
    for (const r of batch) {
      if (memberById.has(r.ladderMemberId)) ratings.set(r.ladderMemberId, r.ratingAfter)
    }

    if (me) {
      const pos = positionOf(me.id)
      if (pos != null && (bestPosition == null || pos < bestPosition)) bestPosition = pos
    }
  }

  // Mejor victoria: rival de mejor puesto al momento; empate → la más reciente.
  let bestWin: BestWin | null = null
  if (winsAtTime.length > 0) {
    const top = [...winsAtTime].sort((a, b) => a.rivalPos - b.rivalPos || b.date.getTime() - a.date.getTime())[0]
    const win = winByMatch.get(top.matchId)!
    const [slugMap, deltaRow] = await Promise.all([
      getPlayerSlugsByUserIds([win.rivalUserId]),
      me
        ? prisma.ratingHistory.findFirst({
            where: { ladderMemberId: me.id, matchId: top.matchId, reason: 'MATCH' },
            select: { delta: true },
          })
        : Promise.resolve(null),
    ])
    bestWin = {
      matchId: top.matchId,
      rivalName: win.rivalName,
      rivalSlug: slugMap.get(win.rivalUserId) ?? null,
      rivalPositionAtTime: top.rivalPos,
      score: win.score,
      date: win.date,
      delta: deltaRow?.delta ?? null,
    }
  }

  return { bestPosition, bestWin }
}

// ============================================================================
// Balance de retos
// ============================================================================

export interface ChallengeSideBalance {
  total: number
  /** PROPOSED todavía dentro de la ventana de respuesta. */
  open: number
  accepted: number
  rejected: number
  expired: number
  cancelled: number
}

export interface ChallengeBalance {
  sent: ChallengeSideBalance
  received: ChallengeSideBalance
  /** % de respuesta positiva al ser retado: aceptados ÷ (aceptados+rechazados+expirados). */
  positivePct: number | null
}

/**
 * Números del mercado de Retos del miembro (públicos a conciencia; ver glosario).
 * Lectura pura: NO expira retos vencidos en BD (criterio de getLadderView) — un
 * PROPOSED con respondByAt vencido se cuenta como expirado en memoria. Los
 * cancelados por el retador no cuentan contra el % del retado.
 */
export async function getChallengeBalance(userId: string): Promise<ChallengeBalance | null> {
  const ladder = await getLadder()
  if (!ladder) return null

  const challenges = await prisma.challenge.findMany({
    where: { ladderId: ladder.id, OR: [{ challengerId: userId }, { challengedId: userId }] },
    select: { status: true, challengerId: true, respondByAt: true },
  })

  const now = Date.now()
  const emptySide = (): ChallengeSideBalance => ({ total: 0, open: 0, accepted: 0, rejected: 0, expired: 0, cancelled: 0 })
  const sent = emptySide()
  const received = emptySide()

  for (const c of challenges) {
    const side = c.challengerId === userId ? sent : received
    side.total++
    switch (c.status) {
      case 'PROPOSED':
        if (c.respondByAt.getTime() < now) side.expired++
        else side.open++
        break
      case 'ACCEPTED':
        side.accepted++
        break
      case 'REJECTED':
        side.rejected++
        break
      case 'EXPIRED':
        side.expired++
        break
      case 'CANCELLED':
        side.cancelled++
        break
    }
  }

  const respondable = received.accepted + received.rejected + received.expired
  const positivePct = respondable > 0 ? Math.round((received.accepted / respondable) * 100) : null

  return { sent, received, positivePct }
}
