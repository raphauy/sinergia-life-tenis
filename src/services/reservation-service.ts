import { prisma } from '@/lib/prisma'
import { renewScheduleDeadline } from '@/services/match-service'
import type { Prisma } from '@prisma/client'
import { fullName } from '@/lib/format-name'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import type { CalendarReservation } from '@/components/court-availability-calendar'

export async function createReservation(data: {
  matchId: string
  scheduledAt: Date
  courtNumber: number
  reservedBy: string
}) {
  // Validate match is PENDING and has both players assigned
  const match = await prisma.match.findUnique({
    where: { id: data.matchId },
    select: {
      status: true,
      reservation: true,
      player1Id: true,
      player2Id: true,
      ladder: { select: { reservationLeadDays: true } },
    },
  })
  if (!match) throw new Error('Partido no encontrado')
  if (match.status !== 'PENDING') throw new Error('Solo se pueden reservar partidos pendientes')
  if (match.reservation) throw new Error('Este partido ya tiene una reserva activa')
  if (!match.player1Id || !match.player2Id) {
    throw new Error('El partido aún no tiene ambos jugadores definidos')
  }

  // Defensa server-side de los límites que el calendario ya aplica en el cliente.
  // Solo escalera: el flujo de torneo mantiene su validación de UI únicamente.
  if (match.ladder) {
    const { toZonedTime, fromZonedTime } = await import('date-fns-tz')
    const { endOfDay, addDays, format } = await import('date-fns')
    const {
      TIMEZONE,
      CLASS_SCHEDULE,
      getSlotsForDay,
      isLadderReservableDay,
      getLadderDaysForWeek,
      formatLadderDays,
    } = await import('@/lib/constants')
    const nowUY = toZonedTime(new Date(), TIMEZONE)
    const maxUTC = fromZonedTime(endOfDay(addDays(nowUY, match.ladder.reservationLeadDays)), TIMEZONE)
    if (data.scheduledAt > maxUTC) {
      throw new Error('Ese horario está fuera del plazo de anticipación permitido.')
    }

    const scheduledUY = toZonedTime(data.scheduledAt, TIMEZONE)
    const dayOfWeek = scheduledUY.getDay()
    const slot = format(scheduledUY, 'HH:mm')

    if (!isLadderReservableDay(scheduledUY)) {
      const days = formatLadderDays(getLadderDaysForWeek(scheduledUY))
      throw new Error(`Ese día La Escalera no puede reservar con anticipación. Esa semana se puede: ${days}.`)
    }
    if (!getSlotsForDay(dayOfWeek).includes(slot)) {
      throw new Error('Ese horario no es un turno válido del club.')
    }
    if (CLASS_SCHEDULE[dayOfWeek]?.includes(slot)) {
      throw new Error('Ese horario está reservado para clase grupal.')
    }
  }

  // Check slot availability: no confirmed matches + no other reservations at same time.
  // Los partidos fuera del club no ocupan cancha.
  const [matchCount, reservationCount] = await Promise.all([
    prisma.match.count({
      where: {
        scheduledAt: data.scheduledAt,
        status: { in: ['CONFIRMED', 'PLAYED'] },
        externalCourt: false,
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

/**
 * La reserva del partido lista para el calendario, sin depender del mes a la vista.
 * El banner "Tenés una reserva" salía de la lista del mes en curso, así que una
 * reserva del mes siguiente no se mostraba y parecía que no habían reservado.
 */
export async function getCalendarReservationByMatch(matchId: string): Promise<CalendarReservation | null> {
  const reservation = await prisma.slotReservation.findUnique({
    where: { matchId },
    select: reservationCalendarSelect,
  })
  return reservation ? mapReservationToCalendar(reservation) : null
}

// Campos que necesita el calendario (mapReservationToCalendar). Compartido entre la
// lectura por mes y la lectura puntual de un partido.
const reservationCalendarSelect = {
  id: true,
  scheduledAt: true,
  courtNumber: true,
  matchId: true,
  user: { select: { firstName: true } },
  match: {
    select: {
      player1: { select: { firstName: true, lastName: true, cedula: true } },
      player2: { select: { firstName: true, lastName: true, cedula: true } },
      category: { select: { name: true } },
      group: { select: { number: true } },
    },
  },
} satisfies Prisma.SlotReservationSelect

// tournamentId opcional: sin él, devuelve TODAS las reservas del mes (global),
// para el cálculo de disponibilidad de canchas compartido torneo + escalera.
export async function getReservationsByMonth(tournamentId: string | undefined, year: number, month: number) {
  const { fromZonedTime } = await import('date-fns-tz')
  const { startOfMonth, endOfMonth } = await import('date-fns')
  const { TIMEZONE } = await import('@/lib/constants')

  const refDate = new Date(year, month - 1, 1)
  const startUTC = fromZonedTime(startOfMonth(refDate), TIMEZONE)
  const endUTC = fromZonedTime(endOfMonth(refDate), TIMEZONE)

  return prisma.slotReservation.findMany({
    where: {
      scheduledAt: { gte: startUTC, lte: endUTC },
      ...(tournamentId ? { match: { tournamentId } } : {}),
    },
    select: reservationCalendarSelect,
    orderBy: { scheduledAt: 'asc' },
  })
}

// Sin tournamentId: cuenta TODAS las reservas pendientes (torneo + escalera).
export async function getPendingReservationCount(tournamentId?: string) {
  return prisma.slotReservation.count({
    where: tournamentId ? { match: { tournamentId } } : {},
  })
}

export async function deleteReservation(id: string) {
  return prisma.slotReservation.delete({
    where: { id },
  })
}

/**
 * Libera una reserva que no llegó a confirmarse (la rechazó el admin, o la soltaron
 * los jugadores para pedir otro horario) y le da plazo nuevo al partido, en una sola
 * transacción: si se borrara la reserva sin renovar, el partido quedaría suelto con
 * el reloj viejo corriendo, que es justo lo que esta feature viene a evitar.
 *
 * Devuelve el nuevo vencimiento, o null si el partido es de torneo (no tiene plazo).
 */
export async function releaseReservation(reservationId: string, matchId: string): Promise<Date | null> {
  return prisma.$transaction(async (tx) => {
    await tx.slotReservation.delete({ where: { id: reservationId } })
    return renewScheduleDeadline(matchId, tx)
  })
}

export async function getReservationsByMatchIds(matchIds: string[]) {
  if (matchIds.length === 0) return []
  return prisma.slotReservation.findMany({
    where: { matchId: { in: matchIds } },
    select: { matchId: true, scheduledAt: true, courtNumber: true },
  })
}

type ReservationForCalendar = Prisma.SlotReservationGetPayload<{ select: typeof reservationCalendarSelect }>

export function mapReservationToCalendar(r: ReservationForCalendar): CalendarReservation {
  return {
    id: r.id,
    matchId: r.matchId,
    scheduledAt: r.scheduledAt.toISOString(),
    timeUY: formatTimeUY(r.scheduledAt),
    dateUY: formatDateUY(r.scheduledAt, 'yyyy-MM-dd'),
    courtNumber: r.courtNumber,
    player1Name: r.match.player1 ? fullName(r.match.player1.firstName, r.match.player1.lastName) : '',
    player2Name: r.match.player2 ? fullName(r.match.player2.firstName, r.match.player2.lastName) : '',
    categoryName: r.match.category?.name ?? '',
    groupNumber: r.match.group?.number ?? null,
    reservedByName: r.user.firstName || 'Jugador',
    player1Cedula: r.match.player1?.cedula ?? null,
    player2Cedula: r.match.player2?.cedula ?? null,
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
