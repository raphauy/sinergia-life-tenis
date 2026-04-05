import { prisma } from '@/lib/prisma'
import { fullName } from '@/lib/format-name'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import type { CalendarReservation } from '@/components/court-availability-calendar'

export async function createReservation(data: {
  matchId: string
  scheduledAt: Date
  courtNumber: number
  reservedBy: string
}) {
  // Validate match is PENDING
  const match = await prisma.match.findUnique({
    where: { id: data.matchId },
    select: { status: true, reservation: true },
  })
  if (!match) throw new Error('Partido no encontrado')
  if (match.status !== 'PENDING') throw new Error('Solo se pueden reservar partidos pendientes')
  if (match.reservation) throw new Error('Este partido ya tiene una reserva activa')

  // Check slot availability: no confirmed matches + no other reservations at same time
  const [matchCount, reservationCount] = await Promise.all([
    prisma.match.count({
      where: {
        scheduledAt: data.scheduledAt,
        status: { in: ['CONFIRMED', 'PLAYED'] },
      },
    }),
    prisma.slotReservation.count({
      where: {
        scheduledAt: data.scheduledAt,
      },
    }),
  ])

  if (matchCount + reservationCount >= 1) {
    throw new Error('Este horario ya está ocupado o reservado')
  }

  return prisma.slotReservation.create({
    data: {
      matchId: data.matchId,
      scheduledAt: data.scheduledAt,
      courtNumber: data.courtNumber,
      reservedBy: data.reservedBy,
    },
  })
}

export async function getReservationByMatch(matchId: string) {
  return prisma.slotReservation.findUnique({
    where: { matchId },
  })
}

export async function getReservationsByMonth(tournamentId: string, year: number, month: number) {
  const { fromZonedTime } = await import('date-fns-tz')
  const { startOfMonth, endOfMonth } = await import('date-fns')
  const { TIMEZONE } = await import('@/lib/constants')

  const refDate = new Date(year, month - 1, 1)
  const startUTC = fromZonedTime(startOfMonth(refDate), TIMEZONE)
  const endUTC = fromZonedTime(endOfMonth(refDate), TIMEZONE)

  return prisma.slotReservation.findMany({
    where: {
      scheduledAt: { gte: startUTC, lte: endUTC },
      match: { tournamentId },
    },
    select: {
      id: true,
      scheduledAt: true,
      courtNumber: true,
      matchId: true,
      user: { select: { firstName: true } },
      match: {
        select: {
          player1: { select: { firstName: true, lastName: true } },
          player2: { select: { firstName: true, lastName: true } },
          category: { select: { name: true } },
          group: { select: { number: true } },
        },
      },
    },
    orderBy: { scheduledAt: 'asc' },
  })
}

export async function getPendingReservationCount(tournamentId: string) {
  return prisma.slotReservation.count({
    where: {
      match: { tournamentId },
    },
  })
}

export async function deleteReservation(id: string) {
  return prisma.slotReservation.delete({
    where: { id },
  })
}

export async function getReservationsByMatchIds(matchIds: string[]) {
  if (matchIds.length === 0) return []
  return prisma.slotReservation.findMany({
    where: { matchId: { in: matchIds } },
    select: { matchId: true, scheduledAt: true, courtNumber: true },
  })
}

export function mapReservationToCalendar(r: Awaited<ReturnType<typeof getReservationsByMonth>>[number]): CalendarReservation {
  return {
    id: r.id,
    matchId: r.matchId,
    scheduledAt: r.scheduledAt.toISOString(),
    timeUY: formatTimeUY(r.scheduledAt),
    dateUY: formatDateUY(r.scheduledAt, 'yyyy-MM-dd'),
    courtNumber: r.courtNumber,
    player1Name: fullName(r.match.player1.firstName, r.match.player1.lastName),
    player2Name: fullName(r.match.player2.firstName, r.match.player2.lastName),
    categoryName: r.match.category.name,
    groupNumber: r.match.group?.number ?? null,
    reservedByName: r.user.firstName || 'Jugador',
  }
}

export async function getReservationById(id: string) {
  return prisma.slotReservation.findUnique({
    where: { id },
    include: {
      match: {
        include: {
          player1: { select: { firstName: true, lastName: true, email: true } },
          player2: { select: { firstName: true, lastName: true, email: true } },
          tournament: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
    },
  })
}
