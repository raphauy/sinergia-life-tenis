import { prisma } from '@/lib/prisma'
import { eloWinnerDelta } from '@/lib/elo'
import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

interface LadderMatch {
  id: string
  ladderId: string | null
  player1Id: string | null
  player2Id: string | null
}

/**
 * Aplica el resultado de un partido de escalera al rating ELO de ambos miembros,
 * dentro de la MISMA transacción que crea el MatchResult. No-op si no es de
 * escalera. Suma-cero: el perdedor recibe el negativo exacto del delta del
 * ganador. Walkover → ELO-neutral (deja 2 filas con delta 0 para trazabilidad
 * y para que una edición posterior tenga filas que recalcular).
 */
export async function applyMatchElo(
  match: LadderMatch,
  winnerId: string,
  isWalkover: boolean,
  tx: Tx
): Promise<void> {
  if (!match.ladderId || !match.player1Id || !match.player2Id) return

  const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id
  const ladder = await tx.ladder.findUnique({ where: { id: match.ladderId }, select: { kFactor: true } })
  if (!ladder) return

  const [winner, loser] = await Promise.all([
    tx.ladderMember.findUnique({ where: { ladderId_userId: { ladderId: match.ladderId, userId: winnerId } } }),
    tx.ladderMember.findUnique({ where: { ladderId_userId: { ladderId: match.ladderId, userId: loserId } } }),
  ])
  // Defensa: si alguno ya no es miembro (fila borrada), no movemos rating.
  if (!winner || !loser) {
    console.warn(`[ELO] Miembro ausente para match ${match.id}; no se aplica ELO.`)
    return
  }

  const delta = isWalkover ? 0 : eloWinnerDelta(ladder.kFactor, winner.rating, loser.rating)

  await Promise.all([
    tx.ladderMember.update({ where: { id: winner.id }, data: { rating: winner.rating + delta } }),
    tx.ladderMember.update({ where: { id: loser.id }, data: { rating: loser.rating - delta } }),
    tx.ratingHistory.create({
      data: {
        ladderMemberId: winner.id,
        reason: 'MATCH',
        matchId: match.id,
        ratingBefore: winner.rating,
        ratingAfter: winner.rating + delta,
        delta,
      },
    }),
    tx.ratingHistory.create({
      data: {
        ladderMemberId: loser.id,
        reason: 'MATCH',
        matchId: match.id,
        ratingBefore: loser.rating,
        ratingAfter: loser.rating - delta,
        delta: -delta,
      },
    }),
  ])
}

/**
 * Recalcula el ELO de un partido de escalera editado, por DELTA LOCAL (sin replay
 * de partidos posteriores): revierte el delta viejo de cada miembro sobre su
 * rating actual, recomputa con los ratingBefore guardados del partido (tolerando
 * cambio de ganador y transición walkover↔normal) y reescribe las 2 filas de
 * historial. No-op si no es de escalera o si no hay filas (no era de escalera).
 */
export async function recalcMatchElo(
  match: LadderMatch,
  newWinnerId: string,
  newIsWalkover: boolean,
  tx: Tx
): Promise<void> {
  if (!match.ladderId) return

  const rows = await tx.ratingHistory.findMany({
    where: { matchId: match.id, reason: 'MATCH' },
    include: { member: { select: { id: true, userId: true, rating: true } } },
  })
  if (rows.length !== 2) {
    console.warn(`[ELO] Edición de match ${match.id} sin 2 filas de historial; se omite recálculo.`)
    return
  }

  const ladder = await tx.ladder.findUnique({ where: { id: match.ladderId }, select: { kFactor: true } })
  if (!ladder) return

  const winnerRow = rows.find((r) => r.member.userId === newWinnerId)
  const loserRow = rows.find((r) => r.member.userId !== newWinnerId)
  if (!winnerRow || !loserRow) {
    console.warn(`[ELO] Ganador ${newWinnerId} no coincide con los miembros del match ${match.id}.`)
    return
  }

  // Nuevo delta computado con los ratings de ANTES de este partido (guardados).
  const newDelta = newIsWalkover ? 0 : eloWinnerDelta(ladder.kFactor, winnerRow.ratingBefore, loserRow.ratingBefore)

  // Por cada miembro: rating_actual − delta_viejo + delta_nuevo (signed).
  const applyRow = async (row: typeof winnerRow, signedNewDelta: number) => {
    const newCurrentRating = row.member.rating - row.delta + signedNewDelta
    await Promise.all([
      tx.ladderMember.update({ where: { id: row.member.id }, data: { rating: newCurrentRating } }),
      tx.ratingHistory.update({
        where: { id: row.id },
        data: { delta: signedNewDelta, ratingAfter: row.ratingBefore + signedNewDelta },
      }),
    ])
  }

  await applyRow(winnerRow, newDelta)
  await applyRow(loserRow, -newDelta)
}

/** Deltas de rating (signed) por userId para un partido jugado (para mostrar en el detalle). */
export async function getMatchRatingDeltas(matchId: string): Promise<Map<string, number>> {
  const rows = await prisma.ratingHistory.findMany({
    where: { matchId, reason: 'MATCH' },
    include: { member: { select: { userId: true } } },
  })
  return new Map(rows.map((r) => [r.member.userId, r.delta]))
}
