import { prisma } from '@/lib/prisma'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { format, startOfDay, addDays } from 'date-fns'
import { TIMEZONE } from '@/lib/constants'
import { fullName } from '@/lib/format-name'
import { getLadder, getLadderRanking } from '@/services/ladder-service'
import { getPlayerSlugsByUserIds } from '@/services/player-service'
import { generatePlayerPanelUrl, sendLadderProtectionCancelledEmail } from '@/services/email-service'
import type { Prisma, ProtectionReason } from '@prisma/client'

type Tx = Prisma.TransactionClient

export const PROTECTION_REASON_LABEL: Record<ProtectionReason, string> = {
  INJURY: 'Lesión',
  TRAVEL: 'Viaje',
  OTHER: 'Otro',
}

export interface ProtectionInfo {
  reason: ProtectionReason
  note: string | null
  startDate: Date
  endDate: Date | null
}

// Día UY (yyyy-MM-dd) → límites del día en UTC (mismo enfoque que parseFromUY).
function dayStartUTC(day: string): Date {
  return fromZonedTime(`${day}T00:00:00.000`, TIMEZONE)
}
function dayEndUTC(day: string): Date {
  return fromZonedTime(`${day}T23:59:59.999`, TIMEZONE)
}

// ============================================================================
// Predicados de "protegido ahora"
// ============================================================================

/**
 * Protección vigente del miembro en este instante: existe un período con
 * startDate <= now y (endDate null o now <= endDate). Devuelve la más reciente.
 */
export async function getCurrentProtection(userId: string, tx?: Tx): Promise<ProtectionInfo | null> {
  const client = tx ?? prisma
  const ladder = await getLadder(tx)
  if (!ladder) return null
  const now = new Date()
  const row = await client.ladderProtection.findFirst({
    where: {
      member: { ladderId: ladder.id, userId },
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: { startDate: 'desc' },
    select: { reason: true, note: true, startDate: true, endDate: true },
  })
  return row
}

export async function isCurrentlyProtected(userId: string, tx?: Tx): Promise<boolean> {
  return (await getCurrentProtection(userId, tx)) != null
}

/**
 * Días de calendario UY del rango [monthStartUTC, monthEndUTC] cubiertos por
 * alguno de los períodos (unión, sin doble conteo). Una protección abierta
 * (endDate null) se considera vigente hasta monthEnd. Helper puro.
 */
export function coveredDaysInMonth(
  periods: { startDate: Date; endDate: Date | null }[],
  monthStartUTC: Date,
  monthEndUTC: Date
): number {
  const days = new Set<string>()
  for (const p of periods) {
    const startMs = Math.max(p.startDate.getTime(), monthStartUTC.getTime())
    const endMs = Math.min((p.endDate ?? monthEndUTC).getTime(), monthEndUTC.getTime())
    if (endMs < startMs) continue
    let cursor = startOfDay(toZonedTime(new Date(startMs), TIMEZONE))
    const endDayUY = startOfDay(toZonedTime(new Date(endMs), TIMEZONE))
    while (cursor <= endDayUY) {
      days.add(format(cursor, 'yyyy-MM-dd'))
      cursor = addDays(cursor, 1)
    }
  }
  return days.size
}

// ============================================================================
// Otorgar / editar / terminar / eliminar
// ============================================================================

export interface SetProtectionParams {
  protectionId?: string
  userId: string
  reason: ProtectionReason
  note: string | null
  startDate: string // yyyy-MM-dd (UY)
  endDate: string | null // yyyy-MM-dd (UY) o null = abierta
  adminId: string
}

/**
 * Crea (o edita si viene protectionId) un período de Ranking protegido. Si el
 * período resultante cubre el presente, limpia el mercado del miembro (cancela
 * sus retos y partidos vivos) y avisa a los rivales por email.
 */
export async function setProtection(params: SetProtectionParams): Promise<void> {
  const ladder = await getLadder()
  if (!ladder) throw new Error('La Escalera no está disponible.')

  const member = await prisma.ladderMember.findUnique({
    where: { ladderId_userId: { ladderId: ladder.id, userId: params.userId } },
    select: { id: true, isActive: true },
  })
  if (!member) throw new Error('Ese jugador no es miembro de La Escalera.')
  if (!member.isActive) throw new Error('Ese jugador no está activo en La Escalera.')

  const startDate = dayStartUTC(params.startDate)
  const endDate = params.endDate ? dayEndUTC(params.endDate) : null

  if (params.protectionId) {
    await prisma.ladderProtection.update({
      where: { id: params.protectionId },
      data: { reason: params.reason, note: params.note, startDate, endDate },
    })
  } else {
    await prisma.ladderProtection.create({
      data: {
        ladderMemberId: member.id,
        reason: params.reason,
        note: params.note,
        startDate,
        endDate,
        createdById: params.adminId,
      },
    })
  }

  const now = new Date()
  const coversNow = startDate <= now && (endDate == null || now <= endDate)
  if (coversNow) {
    await cleanupAndNotify(params.userId, ladder.id, params.reason)
  }
}

/** Termina la protección ahora (endDate = ahora). Conserva el período en el historial. */
export async function endProtection(protectionId: string): Promise<void> {
  await prisma.ladderProtection.update({
    where: { id: protectionId },
    data: { endDate: new Date() },
  })
}

/** Borra una protección (para una creada por error). No deja rastro ni días. */
export async function deleteProtection(protectionId: string): Promise<void> {
  await prisma.ladderProtection.delete({ where: { id: protectionId } })
}

// ============================================================================
// Limpieza del mercado al entrar en protección
// ============================================================================

export interface CleanupResult {
  challengeRivalIds: string[]
  matchRivalIds: string[]
}

/**
 * Cancela los retos PROPOSED (enviados y recibidos) y los partidos de escalera
 * sin jugar (PENDING/CONFIRMED) del miembro. No mueve ELO. Devuelve los rivales
 * afectados para avisarles. Idempotente (si no queda nada vivo, no hace nada).
 */
export async function cleanupMemberLiveItems(userId: string, ladderId: string): Promise<CleanupResult> {
  const [challenges, matches] = await Promise.all([
    prisma.challenge.findMany({
      where: {
        ladderId,
        status: 'PROPOSED',
        OR: [{ challengerId: userId }, { challengedId: userId }],
      },
      select: { id: true, challengerId: true, challengedId: true },
    }),
    prisma.match.findMany({
      where: {
        ladderId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [{ player1Id: userId }, { player2Id: userId }],
      },
      select: { id: true, player1Id: true, player2Id: true },
    }),
  ])

  const challengeIds = challenges.map((c) => c.id)
  const matchIds = matches.map((m) => m.id)
  if (challengeIds.length === 0 && matchIds.length === 0) {
    return { challengeRivalIds: [], matchRivalIds: [] }
  }

  await prisma.$transaction(async (tx) => {
    if (challengeIds.length > 0) {
      await tx.challenge.updateMany({
        where: { id: { in: challengeIds } },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      })
    }
    if (matchIds.length > 0) {
      await tx.slotReservation.deleteMany({ where: { matchId: { in: matchIds } } })
      await tx.match.updateMany({
        where: { id: { in: matchIds } },
        data: { status: 'CANCELLED', scheduledAt: null, courtNumber: null, confirmedAt: null },
      })
    }
  })

  const rivalOf = (a: string | null, b: string | null) => (a === userId ? b : a)
  const challengeRivalIds = challenges
    .map((c) => rivalOf(c.challengerId, c.challengedId))
    .filter((id): id is string => !!id)
  const matchRivalIds = matches
    .map((m) => rivalOf(m.player1Id, m.player2Id))
    .filter((id): id is string => !!id)

  return { challengeRivalIds, matchRivalIds }
}

async function notifyCleanup(
  protectedUserId: string,
  cleanup: CleanupResult,
  reason: ProtectionReason
): Promise<void> {
  const targets = [
    ...cleanup.challengeRivalIds.map((id) => ({ id, kind: 'reto' as const })),
    ...cleanup.matchRivalIds.map((id) => ({ id, kind: 'partido' as const })),
  ]
  if (targets.length === 0) return

  const rivalIds = [...new Set(targets.map((t) => t.id))]
  const [users, slugMap] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: [protectedUserId, ...rivalIds] } },
      select: { id: true, email: true, firstName: true, lastName: true },
    }),
    getPlayerSlugsByUserIds(rivalIds),
  ])
  const userMap = new Map(users.map((u) => [u.id, u]))
  const pu = userMap.get(protectedUserId)
  const protectedName = pu ? fullName(pu.firstName, pu.lastName) || 'Jugador' : 'Jugador'
  const reasonLabel = PROTECTION_REASON_LABEL[reason]

  await Promise.allSettled(
    targets.map((t) => {
      const u = userMap.get(t.id)
      if (!u?.email) return Promise.resolve()
      return sendLadderProtectionCancelledEmail({
        to: u.email,
        recipientName: fullName(u.firstName, u.lastName) || 'Jugador',
        protectedName,
        reasonLabel,
        kind: t.kind,
        actionUrl: generatePlayerPanelUrl(slugMap.get(t.id) ?? null),
      })
    })
  )
}

/** Limpia el mercado del miembro y avisa a los rivales. Devuelve cuántos ítems se cancelaron. */
export async function cleanupAndNotify(
  userId: string,
  ladderId: string,
  reason: ProtectionReason
): Promise<number> {
  const cleanup = await cleanupMemberLiveItems(userId, ladderId)
  await notifyCleanup(userId, cleanup, reason)
  return cleanup.challengeRivalIds.length + cleanup.matchRivalIds.length
}

/**
 * Reconciliación diaria (cron): para cada miembro protegido ahora, cancela y
 * avisa cualquier reto/partido vivo que haya quedado (p.ej. al activarse una
 * protección de inicio futuro). En régimen no hace nada (los guards bloquean
 * crear ítems hacia un protegido). Idempotente.
 */
export async function reconcileProtections(ladderId: string): Promise<number> {
  const now = new Date()
  const protections = await prisma.ladderProtection.findMany({
    where: { member: { ladderId }, startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] },
    orderBy: { startDate: 'desc' },
    select: { reason: true, member: { select: { userId: true } } },
  })
  const reasonByUser = new Map<string, ProtectionReason>()
  for (const p of protections) {
    if (!reasonByUser.has(p.member.userId)) reasonByUser.set(p.member.userId, p.reason)
  }
  let count = 0
  for (const [userId, reason] of reasonByUser) {
    if ((await cleanupAndNotify(userId, ladderId, reason)) > 0) count++
  }
  return count
}

// ============================================================================
// Listado para el admin (pestaña "Miembros")
// ============================================================================

export interface AdminProtectionMemberRow {
  position: number
  userId: string
  name: string
  image: string | null
  playerSlug: string | null
  rating: number
  protection: {
    id: string
    reason: ProtectionReason
    note: string | null
    startDate: Date
    endDate: Date | null
  } | null
}

/** Miembros activos (orden del ranking) + su protección vigente (con id para editar/terminar). */
export async function getMembersForProtectionAdmin(): Promise<AdminProtectionMemberRow[]> {
  const ladder = await getLadder()
  if (!ladder) return []
  const ranking = await getLadderRanking()

  const now = new Date()
  const protections = await prisma.ladderProtection.findMany({
    where: {
      member: { ladderId: ladder.id },
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      reason: true,
      note: true,
      startDate: true,
      endDate: true,
      member: { select: { userId: true } },
    },
  })
  const protByUser = new Map(protections.map((p) => [p.member.userId, p]))

  return ranking.map((e) => {
    const p = protByUser.get(e.userId)
    return {
      position: e.position,
      userId: e.userId,
      name: e.name,
      image: e.image,
      playerSlug: e.playerSlug,
      rating: e.rating,
      protection: p
        ? { id: p.id, reason: p.reason, note: p.note, startDate: p.startDate, endDate: p.endDate }
        : null,
    }
  })
}
