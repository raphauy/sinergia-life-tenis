import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { toZonedTime } from 'date-fns-tz'
import { differenceInCalendarDays } from 'date-fns'
import { getLadder } from '@/services/ladder-service'
import { expireStaleChallenges } from '@/services/challenge-service'
import { getPlayerSlugsByUserIds } from '@/services/player-service'
import { fullName } from '@/lib/format-name'
import { TIMEZONE } from '@/lib/constants'
import { monthRangeUY, daysUntilEndOfMonthUY, monthLabelUY } from '@/lib/date-utils'
import {
  generatePlayerPanelUrl,
  sendLadderPenaltyAppliedEmail,
  sendLadderMonthClosingWarningEmail,
  sendLadderMatchExpiryWarningEmail,
  sendLadderMatchAutoCancelledEmail,
} from '@/services/email-service'

// Partido jugado del mes que cuenta para el mínimo: participó y NO fue el ausente
// del walkover (el ganador por walkover sí suma; el ausente no).
type PlayedRow = {
  player1Id: string | null
  player2Id: string | null
  result: { walkover: boolean; winnerId: string } | null
}
function countPlayedForMember(matches: PlayedRow[], userId: string): number {
  return matches.filter((m) => {
    const participated = m.player1Id === userId || m.player2Id === userId
    if (!participated) return false
    if (m.result?.walkover && m.result.winnerId !== userId) return false
    return true
  }).length
}

// ============================================================================
// Cierre mensual — multa de puntos por no llegar al mínimo de partidos
// ============================================================================

export interface CloseResult {
  alreadyClosed: boolean
  processed: number
  penalized: { name: string; points: number; newRating: number }[]
}

/**
 * Cierra un mes calendario UY (idempotente vía LadderPeriodClose): cuenta los
 * partidos jugados de cada miembro activo y, si no llega al mínimo, le descuenta
 * monthlyPenalty puntos (con piso ratingFloor). La multa es solo puntos: no toca
 * la reserva ni los retos. Los miembros que se incorporaron ese mismo mes tienen
 * gracia (no se penalizan). Emails de multa fuera de la transacción.
 */
export async function closeLadderMonth(year: number, month: number): Promise<CloseResult> {
  const ladder = await getLadder()
  if (!ladder) return { alreadyClosed: false, processed: 0, penalized: [] }

  const { startUTC, endUTC } = monthRangeUY(year, month)

  let processed = 0
  const penalized: { userId: string; email: string | null; name: string; points: number; newRating: number }[] = []

  try {
    const res = await prisma.$transaction(
      async (tx) => {
        let count = 0
        // Guard de idempotencia: el @@unique([ladderId, year, month]) hace fallar
        // un segundo cierre del mismo período (Vercel puede reintentar).
        await tx.ladderPeriodClose.create({ data: { ladderId: ladder.id, year, month } })

        const matches = await tx.match.findMany({
          where: { ladderId: ladder.id, status: 'PLAYED', playedAt: { gte: startUTC, lte: endUTC } },
          select: {
            player1Id: true,
            player2Id: true,
            result: { select: { walkover: true, winnerId: true } },
          },
        })

        const members = await tx.ladderMember.findMany({
          where: { ladderId: ladder.id, isActive: true },
          select: {
            id: true,
            userId: true,
            rating: true,
            joinedAt: true,
            user: { select: { email: true, firstName: true, lastName: true } },
          },
        })

        const localPenalized: typeof penalized = []
        for (const m of members) {
          count++
          // Gracia de alta: se incorporó dentro del mes que se cierra → no se penaliza.
          if (m.joinedAt >= startUTC && m.joinedAt <= endUTC) continue

          const played = countPlayedForMember(matches, m.userId)
          if (played >= ladder.minMatchesPerMonth) continue

          // Piso: la multa no baja el rating por debajo de ratingFloor.
          const points = Math.min(ladder.monthlyPenalty, m.rating - ladder.ratingFloor)
          if (points <= 0) continue

          const newRating = m.rating - points
          await tx.ladderMember.update({ where: { id: m.id }, data: { rating: newRating } })
          await tx.ratingHistory.create({
            data: {
              ladderMemberId: m.id,
              reason: 'PENALTY',
              matchId: null,
              ratingBefore: m.rating,
              ratingAfter: newRating,
              delta: -points,
            },
          })
          localPenalized.push({
            userId: m.userId,
            email: m.user.email,
            name: fullName(m.user.firstName, m.user.lastName) || 'Jugador',
            points,
            newRating,
          })
        }
        return { processed: count, penalized: localPenalized }
      },
      { timeout: 30000, maxWait: 10000 }
    )
    processed = res.processed
    penalized.push(...res.penalized)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { alreadyClosed: true, processed: 0, penalized: [] }
    }
    throw e
  }

  // Emails de multa (fuera de la transacción; no deben hacer fallar el cierre).
  if (penalized.length > 0) {
    try {
      const slugMap = await getPlayerSlugsByUserIds(penalized.map((p) => p.userId))
      const monthLabel = monthLabelUY(year, month)
      await Promise.allSettled(
        penalized
          .filter((p) => p.email)
          .map((p) =>
            sendLadderPenaltyAppliedEmail({
              to: p.email as string,
              playerName: p.name,
              points: p.points,
              newRating: p.newRating,
              monthLabel,
              minMatches: ladder.minMatchesPerMonth,
              actionUrl: generatePlayerPanelUrl(slugMap.get(p.userId) ?? null),
            })
          )
      )
    } catch (e) {
      console.error('[CRON] emails de multa:', e)
    }
  }

  return {
    alreadyClosed: false,
    processed,
    penalized: penalized.map((p) => ({ name: p.name, points: p.points, newRating: p.newRating })),
  }
}

// ============================================================================
// Tareas diarias — expiración de retos, vencimiento de partidos, aviso pre-cierre
// ============================================================================

export interface DailyResult {
  matchesWarned: number
  matchesCancelled: number
  monthWarnings: number
}

export async function runLadderDailyTasks(): Promise<DailyResult> {
  const result: DailyResult = { matchesWarned: 0, matchesCancelled: 0, monthWarnings: 0 }
  const ladder = await getLadder()
  if (!ladder) return result

  // 1. Expirar retos PROPOSED vencidos (sin email). Backstop de la expiración perezosa.
  try {
    await expireStaleChallenges(ladder.id)
  } catch (e) {
    console.error('[CRON] expirar retos:', e)
  }

  // 2. Avisar / auto-cancelar partidos PENDING sin reserva.
  try {
    const r = await processStalePendingMatches(ladder)
    result.matchesWarned = r.warned
    result.matchesCancelled = r.cancelled
  } catch (e) {
    console.error('[CRON] partidos pendientes:', e)
  }

  // 3. Aviso pre-cierre de mes (un único día del mes).
  try {
    result.monthWarnings = await sendMonthClosingWarnings(ladder)
  } catch (e) {
    console.error('[CRON] aviso pre-cierre:', e)
  }

  return result
}

type LadderRow = Awaited<ReturnType<typeof getLadder>>

async function processStalePendingMatches(
  ladder: NonNullable<LadderRow>
): Promise<{ warned: number; cancelled: number }> {
  // Solo PENDING sin reserva: si ya pidieron slot, la pelota está en Mati (no se toca).
  const matches = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: 'PENDING', reservation: { is: null } },
    select: {
      id: true,
      createdAt: true,
      player1Id: true,
      player2Id: true,
      player1: { select: { email: true, firstName: true, lastName: true } },
      player2: { select: { email: true, firstName: true, lastName: true } },
    },
  })
  if (matches.length === 0) return { warned: 0, cancelled: 0 }

  const nowUY = toZonedTime(new Date(), TIMEZONE)
  const deadline = ladder.matchScheduleDeadlineDays
  const userIds = matches.flatMap((m) => [m.player1Id, m.player2Id]).filter((id): id is string => !!id)
  const slugMap = await getPlayerSlugsByUserIds(userIds)

  let warned = 0
  let cancelled = 0

  for (const m of matches) {
    const daysSince = differenceInCalendarDays(nowUY, toZonedTime(m.createdAt, TIMEZONE))

    if (daysSince >= deadline) {
      await prisma.$transaction(async (tx) => {
        await tx.slotReservation.deleteMany({ where: { matchId: m.id } })
        await tx.match.update({
          where: { id: m.id },
          data: { status: 'CANCELLED', scheduledAt: null, courtNumber: null, confirmedAt: null },
        })
      })
      cancelled++
      await notifyBothPlayers(m, slugMap, 'cancelled', 0)
    } else if (daysSince === deadline - 1) {
      warned++
      await notifyBothPlayers(m, slugMap, 'warning', deadline - daysSince)
    }
  }

  return { warned, cancelled }
}

type MatchPlayers = {
  id: string
  player1Id: string | null
  player2Id: string | null
  player1: { email: string | null; firstName: string | null; lastName: string | null } | null
  player2: { email: string | null; firstName: string | null; lastName: string | null } | null
}

async function notifyBothPlayers(
  m: MatchPlayers,
  slugMap: Map<string, string>,
  kind: 'warning' | 'cancelled',
  daysLeft: number
): Promise<void> {
  const p1 = m.player1
  const p2 = m.player2
  const p1Name = fullName(p1?.firstName, p1?.lastName) || 'Jugador'
  const p2Name = fullName(p2?.firstName, p2?.lastName) || 'Jugador'

  const sendTo = async (
    email: string | null,
    selfName: string,
    rivalName: string,
    selfUserId: string | null
  ) => {
    if (!email) return
    const actionUrl = generatePlayerPanelUrl(selfUserId ? slugMap.get(selfUserId) ?? null : null)
    try {
      if (kind === 'warning') {
        await sendLadderMatchExpiryWarningEmail({ to: email, playerName: selfName, rivalName, daysLeft, actionUrl })
      } else {
        await sendLadderMatchAutoCancelledEmail({ to: email, playerName: selfName, rivalName, actionUrl })
      }
    } catch (e) {
      console.error(`[CRON] email partido (${kind}):`, e)
    }
  }

  await Promise.allSettled([
    sendTo(p1?.email ?? null, p1Name, p2Name, m.player1Id),
    sendTo(p2?.email ?? null, p2Name, p1Name, m.player2Id),
  ])
}

async function sendMonthClosingWarnings(ladder: NonNullable<LadderRow>): Promise<number> {
  // Dispara un único día del mes (best-effort): cuando faltan exactamente N días.
  if (daysUntilEndOfMonthUY() !== ladder.monthlyWarningLeadDays) return 0

  const nowUY = toZonedTime(new Date(), TIMEZONE)
  const { startUTC, endUTC } = monthRangeUY(nowUY.getFullYear(), nowUY.getMonth() + 1)

  const [members, matches] = await Promise.all([
    prisma.ladderMember.findMany({
      where: { ladderId: ladder.id, isActive: true },
      select: {
        userId: true,
        joinedAt: true,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    }),
    prisma.match.findMany({
      where: { ladderId: ladder.id, status: 'PLAYED', playedAt: { gte: startUTC, lte: endUTC } },
      select: { player1Id: true, player2Id: true, result: { select: { walkover: true, winnerId: true } } },
    }),
  ])

  const candidates = members.filter((m) => {
    if (!m.user.email) return false
    // Gracia de alta: no avisamos a quien se incorporó este mes (no se penalizará).
    if (m.joinedAt >= startUTC && m.joinedAt <= endUTC) return false
    return countPlayedForMember(matches, m.userId) < ladder.minMatchesPerMonth
  })
  if (candidates.length === 0) return 0

  const slugMap = await getPlayerSlugsByUserIds(candidates.map((m) => m.userId))
  const daysLeft = ladder.monthlyWarningLeadDays

  const results = await Promise.allSettled(
    candidates.map((m) =>
      sendLadderMonthClosingWarningEmail({
        to: m.user.email as string,
        playerName: fullName(m.user.firstName, m.user.lastName) || 'Jugador',
        played: countPlayedForMember(matches, m.userId),
        min: ladder.minMatchesPerMonth,
        daysLeft,
        penalty: ladder.monthlyPenalty,
        actionUrl: generatePlayerPanelUrl(slugMap.get(m.userId) ?? null),
      })
    )
  )
  return results.filter((r) => r.status === 'fulfilled').length
}
