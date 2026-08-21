import { prisma } from '@/lib/prisma'
import { endOfDayInDaysUY } from '@/lib/date-utils'
import type { MatchStage, MatchStatus, Prisma } from '@prisma/client'

const matchIncludes = {
  player1: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, image: true } },
  player2: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, image: true } },
  tournament: { select: { id: true, name: true, matchFormat: true, finalsDate: true } },
  ladder: { select: { id: true, name: true, matchFormat: true, matchScheduleDeadlineDays: true, reservationLeadDays: true } },
  category: {
    select: {
      id: true,
      name: true,
      _count: { select: { matches: { where: { stage: 'QUARTERFINAL' } } } },
    },
  },
  group: { select: { id: true, number: true } },
  player1SourceGroup: { select: { id: true, number: true } },
  player2SourceGroup: { select: { id: true, number: true } },
  result: { include: { reportedBy: { select: { firstName: true, lastName: true } } } },
} as const

export async function createMatch(data: {
  tournamentId: string
  categoryId: string
  player1Id: string
  player2Id: string
  courtNumber?: number
  scheduledAt?: Date
}) {
  const isConfirmed = data.scheduledAt && data.courtNumber

  return prisma.match.create({
    data: {
      tournamentId: data.tournamentId,
      categoryId: data.categoryId,
      player1Id: data.player1Id,
      player2Id: data.player2Id,
      courtNumber: data.courtNumber,
      scheduledAt: data.scheduledAt,
      status: isConfirmed ? 'CONFIRMED' : 'PENDING',
      confirmedAt: isConfirmed ? new Date() : undefined,
    },
    include: matchIncludes,
  })
}

export async function getMatches(filters?: {
  tournamentId?: string
  categoryId?: string
  groupId?: string
  status?: MatchStatus
  stage?: MatchStage
}) {
  return prisma.match.findMany({
    where: {
      ...(filters?.tournamentId ? { tournamentId: filters.tournamentId } : {}),
      ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters?.groupId ? { groupId: filters.groupId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.stage ? { stage: filters.stage } : {}),
    },
    include: matchIncludes,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getMatchById(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: matchIncludes,
  })
}

/**
 * Renueva entero el plazo para concretar un partido de escalera: `scheduleDeadlineAt`
 * al fin del día UY dentro de N días y el aviso a cero.
 *
 * Se llama cada vez que se quedan sin reserva sin haberla podido usar (el admin la
 * rechazó, alguno la canceló para pedir otro horario, o el turno pasó sin confirmarse).
 * El reloj no corre mientras la reserva espera al admin, así que perder la reserva
 * nunca los acerca a la muerte del partido — que es exactamente lo que pasaba antes:
 * el cron medía sobre `createdAt` y los mataba en la corrida siguiente, sin aviso.
 *
 * Devuelve el nuevo vencimiento, o null si el partido es de torneo (no tiene plazo):
 * así quien renueva puede avisarlo sin volver a leer el partido.
 */
export async function renewScheduleDeadline(
  matchId: string,
  tx?: Prisma.TransactionClient
): Promise<Date | null> {
  const client = tx ?? prisma
  const match = await client.match.findUnique({
    where: { id: matchId },
    select: { ladder: { select: { matchScheduleDeadlineDays: true } } },
  })
  if (!match?.ladder) return null

  const scheduleDeadlineAt = endOfDayInDaysUY(match.ladder.matchScheduleDeadlineDays)
  await client.match.update({
    where: { id: matchId },
    data: { scheduleDeadlineAt, scheduleWarnedAt: null },
  })
  return scheduleDeadlineAt
}

export async function confirmMatch(
  id: string,
  data: { scheduledAt: Date; courtNumber: number }
) {
  const match = await prisma.match.findUnique({ where: { id } })
  if (!match) throw new Error('Partido no encontrado')
  if (match.status !== 'PENDING') throw new Error('Solo se pueden confirmar partidos pendientes')
  if (!match.player1Id || !match.player2Id) {
    throw new Error('El partido aún no tiene ambos jugadores definidos')
  }

  return prisma.match.update({
    where: { id },
    data: {
      scheduledAt: data.scheduledAt,
      courtNumber: data.courtNumber,
      externalCourt: false,
      selfScheduled: false, // lo confirma el admin
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    },
    include: matchIncludes,
  })
}

/**
 * Autoagendado de escalera: el jugador ya consiguió cancha por su cuenta (por la app
 * del club o fuera del club) y confirma el partido sin pasar por el admin. Acepta
 * fechas pasadas (hasta SELF_SCHEDULE_PAST_DAYS) para cargar partidos ya jugados.
 */
export async function selfScheduleLadderMatch(
  matchId: string,
  actorId: string,
  data: { scheduledAt: Date; courtNumber: number | null; external: boolean }
) {
  if (data.external !== (data.courtNumber == null)) {
    throw new Error('Datos de cancha inconsistentes')
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      status: true,
      ladderId: true,
      player1Id: true,
      player2Id: true,
      ladder: { select: { reservationLeadDays: true } },
    },
  })
  if (!match) throw new Error('Partido no encontrado')
  if (!match.ladderId || !match.ladder) throw new Error('Solo se pueden autoagendar partidos de La Escalera')
  if (match.status !== 'PENDING') throw new Error('Solo se pueden agendar partidos pendientes')
  if (!match.player1Id || !match.player2Id) {
    throw new Error('El partido aún no tiene ambos jugadores definidos')
  }
  if (actorId !== match.player1Id && actorId !== match.player2Id) {
    throw new Error('No autorizado para este partido')
  }

  const { toZonedTime, fromZonedTime } = await import('date-fns-tz')
  const { startOfDay, endOfDay, addDays, subDays, format } = await import('date-fns')
  const { TIMEZONE, CLASS_SCHEDULE, getSlotsForDay, SELF_SCHEDULE_PAST_DAYS } = await import('@/lib/constants')

  const nowUY = toZonedTime(new Date(), TIMEZONE)
  const minUTC = fromZonedTime(startOfDay(subDays(nowUY, SELF_SCHEDULE_PAST_DAYS)), TIMEZONE)
  const maxUTC = fromZonedTime(endOfDay(addDays(nowUY, match.ladder.reservationLeadDays)), TIMEZONE)
  if (data.scheduledAt < minUTC) {
    throw new Error(`No se pueden cargar partidos de más de ${SELF_SCHEDULE_PAST_DAYS} días atrás.`)
  }
  if (data.scheduledAt > maxUTC) {
    throw new Error('Ese horario está fuera del plazo de anticipación permitido.')
  }

  // Cancha del club: el turno tiene que ser válido. Fuera del club no ocupa nada.
  if (!data.external) {
    const scheduledUY = toZonedTime(data.scheduledAt, TIMEZONE)
    const dayOfWeek = scheduledUY.getDay()
    const slot = format(scheduledUY, 'HH:mm')
    if (!getSlotsForDay(dayOfWeek).includes(slot)) {
      throw new Error('Ese horario no es un turno válido del club.')
    }
    if (CLASS_SCHEDULE[dayOfWeek]?.includes(slot)) {
      throw new Error('Ese horario está reservado para clase grupal.')
    }
  }

  return prisma.$transaction(async (tx) => {
    // La ocupación se chequea acá adentro: confirmar dos partidos en el mismo slot
    // es más caro de deshacer que una reserva duplicada. A diferencia de
    // createReservation (que bloquea el horario entero), acá se mira SOLO la cancha
    // que el jugador dice tener: si la sacó por la app del club, que la otra esté
    // ocupada no es su problema — si no, lo empujaríamos a mentir "fuera del club".
    if (!data.external && data.courtNumber != null) {
      const court = data.courtNumber
      const [matchCount, reservationCount] = await Promise.all([
        tx.match.count({
          where: {
            scheduledAt: data.scheduledAt,
            courtNumber: court,
            status: { in: ['CONFIRMED', 'PLAYED'] },
            externalCourt: false,
            id: { not: matchId },
          },
        }),
        // La reserva propia no cuenta: pueden haber conseguido el mismo slot que pidieron.
        tx.slotReservation.count({
          where: {
            scheduledAt: data.scheduledAt,
            courtNumber: court,
            matchId: { not: matchId },
          },
        }),
      ])
      if (matchCount + reservationCount >= 1) {
        throw new Error('Esa cancha ya está ocupada o reservada a esa hora')
      }
    }

    await tx.slotReservation.deleteMany({ where: { matchId } })
    return tx.match.update({
      where: { id: matchId },
      data: {
        scheduledAt: data.scheduledAt,
        courtNumber: data.courtNumber,
        externalCourt: data.external,
        selfScheduled: true,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
      include: matchIncludes,
    })
  })
}

export async function rescheduleMatch(
  id: string,
  data: { scheduledAt: Date; courtNumber: number }
) {
  const match = await prisma.match.findUnique({ where: { id } })
  if (!match) throw new Error('Partido no encontrado')
  if (match.status !== 'CONFIRMED') throw new Error('Solo se pueden reprogramar partidos confirmados')

  return prisma.match.update({
    where: { id },
    data: {
      scheduledAt: data.scheduledAt,
      courtNumber: data.courtNumber,
      externalCourt: false,
      selfScheduled: false, // pasa a ser una cancha que gestiona el admin
    },
    include: matchIncludes,
  })
}

export async function updateMatchCourt(id: string, courtNumber: number) {
  const match = await prisma.match.findUnique({ where: { id } })
  if (!match) throw new Error('Partido no encontrado')
  if (match.status !== 'CONFIRMED') throw new Error('Solo se puede cambiar cancha de partidos confirmados')

  return prisma.match.update({
    where: { id },
    data: { courtNumber, externalCourt: false, selfScheduled: false },
    include: matchIncludes,
  })
}

export async function cancelMatch(id: string) {
  const match = await prisma.match.findUnique({ where: { id } })
  if (!match) throw new Error('Partido no encontrado')
  if (match.status === 'PLAYED') throw new Error('No se puede cancelar un partido ya jugado')

  return prisma.match.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: matchIncludes,
  })
}

export async function revertMatchToPending(id: string) {
  const match = await prisma.match.findUnique({ where: { id } })
  if (!match) throw new Error('Partido no encontrado')
  if (match.status !== 'CONFIRMED') throw new Error('Solo se pueden revertir partidos confirmados')

  // Vuelve a estar "a coordinar": reloj fresco, no el que traía de antes de confirmarse.
  // Va antes del update para que el match devuelto ya traiga el plazo nuevo.
  await renewScheduleDeadline(id)
  return prisma.match.update({
    where: { id },
    data: {
      status: 'PENDING',
      scheduledAt: null,
      courtNumber: null,
      externalCourt: false,
      selfScheduled: false,
      confirmedAt: null,
    },
    include: matchIncludes,
  })
}

export async function getTodayMatches(tournamentId: string) {
  // Calculate today's boundaries in Uruguay timezone
  const { toZonedTime } = await import('date-fns-tz')
  const { startOfDay, endOfDay } = await import('date-fns')
  const { fromZonedTime } = await import('date-fns-tz')
  const { TIMEZONE } = await import('@/lib/constants')

  const nowUY = toZonedTime(new Date(), TIMEZONE)
  const startUTC = fromZonedTime(startOfDay(nowUY), TIMEZONE)
  const endUTC = fromZonedTime(endOfDay(nowUY), TIMEZONE)

  return prisma.match.findMany({
    where: {
      tournamentId,
      scheduledAt: { gte: startUTC, lte: endUTC },
      status: { not: 'CANCELLED' },
    },
    include: matchIncludes,
    orderBy: { scheduledAt: 'asc' },
  })
}

export async function getMatchesByPlayer(userId: string) {
  // Orden por fecha del partido (scheduledAt) desc → el más reciente arriba. En
  // escalera createdAt es cuándo se aceptó el reto, no cuándo se jugó, así que
  // ordenar por createdAt descoloca el historial. Los sin fecha (algún partido de
  // torneo) caen al final, desempatados por createdAt. Los consumidores re-ordenan
  // los próximos partidos por su cuenta; este orden gobierna el historial jugado.
  return prisma.match.findMany({
    where: {
      OR: [{ player1Id: userId }, { player2Id: userId }],
    },
    include: matchIncludes,
    orderBy: [{ scheduledAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  })
}

// tournamentId opcional: sin él, devuelve la ocupación GLOBAL de canchas (torneo
// + escalera). Las canchas son físicas y compartidas, así que la disponibilidad
// para reservar se calcula global; el filtro por torneo es solo para listados.
// Los partidos jugados fuera del club quedan excluidos: no ocupan cancha.
export async function getMonthMatches(tournamentId: string | undefined, year: number, month: number) {
  const { toZonedTime, fromZonedTime } = await import('date-fns-tz')
  const { startOfMonth, endOfMonth } = await import('date-fns')
  const { TIMEZONE } = await import('@/lib/constants')

  // Build UY month boundaries, convert to UTC
  const refDate = new Date(year, month - 1, 1) // local ref, just to build zoned
  const zonedStart = startOfMonth(refDate)
  const zonedEnd = endOfMonth(refDate)
  const startUTC = fromZonedTime(zonedStart, TIMEZONE)
  const endUTC = fromZonedTime(zonedEnd, TIMEZONE)

  return prisma.match.findMany({
    where: {
      ...(tournamentId ? { tournamentId } : {}),
      scheduledAt: { gte: startUTC, lte: endUTC },
      status: { in: ['CONFIRMED', 'PLAYED'] },
      externalCourt: false,
    },
    select: {
      id: true,
      scheduledAt: true,
      courtNumber: true,
      player1: { select: { firstName: true, lastName: true } },
      player2: { select: { firstName: true, lastName: true } },
      category: { select: { name: true } },
      group: { select: { number: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  })
}

export async function getPendingMatches(tournamentId: string) {
  return prisma.match.findMany({
    where: {
      tournamentId,
      status: 'PENDING',
      // Exclude bracket slots that don't have both players assigned yet
      player1Id: { not: null },
      player2Id: { not: null },
    },
    select: {
      id: true,
      player1: { select: { firstName: true, lastName: true } },
      player2: { select: { firstName: true, lastName: true } },
      category: { select: { name: true } },
      group: { select: { number: true } },
      stage: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getUpcomingMatches(userId: string) {
  return prisma.match.findMany({
    where: {
      OR: [{ player1Id: userId }, { player2Id: userId }],
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    include: matchIncludes,
    orderBy: { createdAt: 'desc' },
  })
}
