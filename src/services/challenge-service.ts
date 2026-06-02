import { prisma } from '@/lib/prisma'
import { getLadder, getLadderRanking, type LadderEntry } from '@/services/ladder-service'
import { getPlayerSlugsByUserIds } from '@/services/player-service'
import { fullName } from '@/lib/format-name'
import { blobUrl } from '@/lib/blob-url'
import { eloPreview } from '@/lib/elo'
import type { Prisma, Challenge, ChallengeStatus } from '@prisma/client'

type Tx = Prisma.TransactionClient

// Suma/resta días sobre un instante UTC. Sumar días enteros es timezone-agnóstico
// (no nos importa el wall-clock UY para "+N días" de una ventana/cooldown).
function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Límites del mes calendario UY corriente, en UTC (mismo patrón que getMonthMatches).
async function currentMonthRangeUY(): Promise<{ startUTC: Date; endUTC: Date }> {
  const { toZonedTime, fromZonedTime } = await import('date-fns-tz')
  const { startOfMonth, endOfMonth } = await import('date-fns')
  const { TIMEZONE } = await import('@/lib/constants')
  const nowUY = toZonedTime(new Date(), TIMEZONE)
  return {
    startUTC: fromZonedTime(startOfMonth(nowUY), TIMEZONE),
    endUTC: fromZonedTime(endOfMonth(nowUY), TIMEZONE),
  }
}

// "Reto vivo" del lado del retador para el cap de abiertos: PROPOSED, o ACCEPTED
// cuyo partido todavía no se jugó (PENDING/CONFIRMED). Un partido CANCELLED/PLAYED
// deja de contar (libera cupo).
const openChallengeWhere = (challengerId: string): Prisma.ChallengeWhereInput => ({
  challengerId,
  OR: [
    { status: 'PROPOSED' },
    { status: 'ACCEPTED', match: { status: { in: ['PENDING', 'CONFIRMED'] } } },
  ],
})

// ============================================================================
// Expiración perezosa (sin cron en Fase 2)
// ============================================================================

/** Expira en el acto todo PROPOSED vencido de la escalera. Idempotente. */
export async function expireStaleChallenges(ladderId: string, tx?: Tx): Promise<void> {
  const client = tx ?? prisma
  await client.challenge.updateMany({
    where: { ladderId, status: 'PROPOSED', respondByAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  })
}

// ============================================================================
// Validaciones internas de caps / par / cooldown
// ============================================================================

async function countOpenChallenges(challengerId: string, tx?: Tx): Promise<number> {
  const client = tx ?? prisma
  return client.challenge.count({ where: openChallengeWhere(challengerId) })
}

async function countMonthlyChallenges(ladderId: string, challengerId: string, tx?: Tx): Promise<number> {
  const client = tx ?? prisma
  const { startUTC, endUTC } = await currentMonthRangeUY()
  return client.challenge.count({
    where: { ladderId, challengerId, proposedAt: { gte: startUTC, lte: endUTC } },
  })
}

/** ¿Hay un reto vivo (PROPOSED o ACCEPTED-sin-jugar) entre A y B en cualquier dirección? */
async function hasActiveChallengeBetween(ladderId: string, aId: string, bId: string, tx?: Tx): Promise<boolean> {
  const client = tx ?? prisma
  const count = await client.challenge.count({
    where: {
      ladderId,
      OR: [
        { challengerId: aId, challengedId: bId },
        { challengerId: bId, challengedId: aId },
      ],
      // El reto sigue "vivo" si está PROPOSED o si su partido aún no concluyó.
      // (Mira el estado del match, no solo del challenge: tras cancelar el
      // partido, el challenge queda ACCEPTED pero deja de bloquear.)
      AND: {
        OR: [
          { status: 'PROPOSED' },
          { status: 'ACCEPTED', match: { status: { in: ['PENDING', 'CONFIRMED'] } } },
        ],
      },
    },
  })
  return count > 0
}

/** ¿Jugaron A y B un partido de escalera hace menos de cooldownDays? */
async function isInRematchCooldown(ladderId: string, aId: string, bId: string, cooldownDays: number, tx?: Tx): Promise<boolean> {
  if (cooldownDays <= 0) return false
  const client = tx ?? prisma
  const recent = await client.match.findFirst({
    where: {
      ladderId,
      status: 'PLAYED',
      playedAt: { gt: addDays(new Date(), -cooldownDays) },
      OR: [
        { player1Id: aId, player2Id: bId },
        { player1Id: bId, player2Id: aId },
      ],
    },
    select: { id: true },
  })
  return recent != null
}

async function memberOf(ladderId: string, userId: string, tx: Tx) {
  return tx.ladderMember.findUnique({
    where: { ladderId_userId: { ladderId, userId } },
    select: { id: true, isActive: true, rating: true },
  })
}

// ============================================================================
// Ciclo del reto
// ============================================================================

export async function createChallenge(challengerId: string, challengedId: string): Promise<Challenge> {
  if (challengerId === challengedId) throw new Error('No podés retarte a vos mismo.')
  const ladder = await getLadder()
  if (!ladder) throw new Error('La Escalera no está disponible.')

  return prisma.$transaction(async (tx) => {
    await expireStaleChallenges(ladder.id, tx)

    const [challenger, challenged] = await Promise.all([
      memberOf(ladder.id, challengerId, tx),
      memberOf(ladder.id, challengedId, tx),
    ])
    if (!challenger || !challenger.isActive) throw new Error('No sos miembro activo de La Escalera.')
    if (!challenged || !challenged.isActive) throw new Error('Ese jugador no es miembro activo de La Escalera.')

    if (await hasActiveChallengeBetween(ladder.id, challengerId, challengedId, tx)) {
      throw new Error('Ya tienen un reto o partido pendiente entre ustedes.')
    }
    if (await isInRematchCooldown(ladder.id, challengerId, challengedId, ladder.rematchCooldownDays, tx)) {
      throw new Error(`Ya jugaron hace poco. Esperá unos días para la revancha.`)
    }
    if ((await countOpenChallenges(challengerId, tx)) >= ladder.maxOpenChallenges) {
      throw new Error(`Tenés ${ladder.maxOpenChallenges} retos abiertos. Cerrá alguno antes de iniciar otro.`)
    }
    if ((await countMonthlyChallenges(ladder.id, challengerId, tx)) >= ladder.maxChallengesPerMonth) {
      throw new Error(`Llegaste al máximo de ${ladder.maxChallengesPerMonth} retos este mes.`)
    }

    return tx.challenge.create({
      data: {
        ladderId: ladder.id,
        challengerId,
        challengedId,
        respondByAt: addDays(new Date(), ladder.acceptanceWindowDays),
      },
    })
  })
}

export async function acceptChallenge(challengeId: string, actorId: string): Promise<{ challenge: Challenge; matchId: string }> {
  return prisma.$transaction(async (tx) => {
    const challenge = await tx.challenge.findUnique({ where: { id: challengeId } })
    if (!challenge) throw new Error('Reto no encontrado.')
    if (challenge.challengedId !== actorId) throw new Error('Solo el retado puede aceptar.')
    if (challenge.status !== 'PROPOSED') throw new Error('Este reto ya fue respondido.')
    if (challenge.respondByAt < new Date()) {
      await tx.challenge.update({ where: { id: challengeId }, data: { status: 'EXPIRED' } })
      throw new Error('El reto venció.')
    }

    const match = await tx.match.create({
      data: {
        ladderId: challenge.ladderId,
        player1Id: challenge.challengerId,
        player2Id: challenge.challengedId,
        status: 'PENDING',
      },
    })
    const updated = await tx.challenge.update({
      where: { id: challengeId },
      data: { status: 'ACCEPTED', respondedAt: new Date(), matchId: match.id },
    })
    return { challenge: updated, matchId: match.id }
  })
}

export async function rejectChallenge(challengeId: string, actorId: string): Promise<Challenge> {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } })
  if (!challenge) throw new Error('Reto no encontrado.')
  if (challenge.challengedId !== actorId) throw new Error('Solo el retado puede rechazar.')
  if (challenge.status !== 'PROPOSED') throw new Error('Este reto ya fue respondido.')
  return prisma.challenge.update({
    where: { id: challengeId },
    data: { status: 'REJECTED', respondedAt: new Date() },
  })
}

export async function cancelChallenge(challengeId: string, actorId: string): Promise<Challenge> {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } })
  if (!challenge) throw new Error('Reto no encontrado.')
  if (challenge.challengerId !== actorId) throw new Error('Solo quien retó puede cancelar el reto.')
  if (challenge.status !== 'PROPOSED') throw new Error('El reto ya no se puede cancelar.')
  return prisma.challenge.update({
    where: { id: challengeId },
    data: { status: 'CANCELLED', respondedAt: new Date() },
  })
}

/** Cancela un partido de escalera pendiente/confirmado. No mueve ELO; libera el cupo. */
export async function cancelLadderMatch(matchId: string, actorId: string, isAdmin: boolean): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, ladderId: true, player1Id: true, player2Id: true, status: true },
  })
  if (!match) throw new Error('Partido no encontrado.')
  if (!match.ladderId) throw new Error('No es un partido de La Escalera.')
  if (match.status === 'PLAYED') throw new Error('No se puede cancelar un partido ya jugado.')
  if (match.status === 'CANCELLED') throw new Error('El partido ya está cancelado.')

  const isParticipant = match.player1Id === actorId || match.player2Id === actorId
  if (!isParticipant && !isAdmin) throw new Error('No autorizado para este partido.')

  await prisma.$transaction(async (tx) => {
    await tx.slotReservation.deleteMany({ where: { matchId } })
    await tx.match.update({
      where: { id: matchId },
      data: { status: 'CANCELLED', scheduledAt: null, courtNumber: null, confirmedAt: null },
    })
  })
}

// ============================================================================
// Lecturas para UI
// ============================================================================

export interface InboxChallenge {
  id: string
  status: ChallengeStatus
  proposedAt: Date
  respondByAt: Date
  matchId: string | null
  // Preview ELO desde la perspectiva del dueño de la bandeja (cuánto gana/pierde).
  preview: { ifWin: number; ifLose: number } | null
  rival: {
    userId: string
    name: string
    image: string | null
    rating: number | null
    position: number | null
    playerSlug: string | null
  }
}

/** Bandeja de retos PROPOSED del usuario (recibidos para responder, enviados para cancelar). */
export async function getInbox(userId: string): Promise<{ received: InboxChallenge[]; sent: InboxChallenge[] }> {
  const ladder = await getLadder()
  if (!ladder) return { received: [], sent: [] }
  await expireStaleChallenges(ladder.id)

  const challenges = await prisma.challenge.findMany({
    where: {
      ladderId: ladder.id,
      status: 'PROPOSED',
      OR: [{ challengedId: userId }, { challengerId: userId }],
    },
    include: {
      challenger: { select: { firstName: true, lastName: true, image: true } },
      challenged: { select: { firstName: true, lastName: true, image: true } },
    },
    orderBy: { proposedAt: 'asc' },
  })

  const rivalIds = challenges.map((c) => (c.challengerId === userId ? c.challengedId : c.challengerId))
  const [members, slugMap] = await Promise.all([
    // Todos los miembros activos en el orden de la escalera: de acá salen el
    // rating y el puesto (#) de cada rival —lo que importa para decidir si
    // aceptar un reto—.
    prisma.ladderMember.findMany({
      where: { ladderId: ladder.id, isActive: true },
      orderBy: [{ rating: 'desc' }, { joinedAt: 'asc' }, { id: 'asc' }],
      select: { userId: true, rating: true },
    }),
    getPlayerSlugsByUserIds(rivalIds),
  ])
  const ratingMap = new Map(members.map((m) => [m.userId, m.rating]))
  const positionMap = new Map(members.map((m, i) => [m.userId, i + 1]))
  const viewerRating = ratingMap.get(userId) ?? null

  const toEntry = (c: (typeof challenges)[number]): InboxChallenge => {
    const isSent = c.challengerId === userId
    const rivalUser = isSent ? c.challenged : c.challenger
    const rivalId = isSent ? c.challengedId : c.challengerId
    const rivalRating = ratingMap.get(rivalId) ?? null
    const preview =
      viewerRating != null && rivalRating != null ? eloPreview(ladder.kFactor, viewerRating, rivalRating) : null
    return {
      id: c.id,
      status: c.status,
      proposedAt: c.proposedAt,
      respondByAt: c.respondByAt,
      matchId: c.matchId,
      preview,
      rival: {
        userId: rivalId,
        name: fullName(rivalUser.firstName, rivalUser.lastName) || 'Jugador',
        image: blobUrl(rivalUser.image) || null,
        rating: rivalRating,
        position: positionMap.get(rivalId) ?? null,
        playerSlug: slugMap.get(rivalId) ?? null,
      },
    }
  }

  return {
    received: challenges.filter((c) => c.challengedId === userId).map(toEntry),
    sent: challenges.filter((c) => c.challengerId === userId).map(toEntry),
  }
}

export interface PendingChallengeParty {
  userId: string
  name: string
  image: string | null
  playerSlug: string | null
  rating: number
  position: number
}

export interface PublicPendingChallenge {
  id: string
  challenger: PendingChallengeParty
  challenged: PendingChallengeParty
  // Puntos en juego desde la perspectiva del retador (challenger): +gana / pierde.
  ifWin: number
  ifLose: number
  proposedAt: Date
  respondByAt: Date
}

/**
 * Retos PROPOSED vivos de toda la escalera, para la vista pública de Partidos
 * (global, read-only, también anónima). Filtra los vencidos por `respondByAt` sin
 * escribir (igual que getLadderView, para no disparar un updateMany en cada GET
 * público); el flip a EXPIRED lo hacen el cron diario y los write-paths. Toma
 * nombre/avatar/puntos/puesto del ranking ya resuelto; descarta retos donde algún
 * participante quedó inactivo (fuera del ranking).
 */
export async function getPendingChallenges(): Promise<PublicPendingChallenge[]> {
  const ladder = await getLadder()
  if (!ladder) return []

  const ranking = await getLadderRanking()
  const standByUser = new Map(ranking.map((e) => [e.userId, e]))

  const challenges = await prisma.challenge.findMany({
    where: { ladderId: ladder.id, status: 'PROPOSED', respondByAt: { gte: new Date() } },
    select: { id: true, challengerId: true, challengedId: true, proposedAt: true, respondByAt: true },
    orderBy: { proposedAt: 'asc' },
  })

  const toParty = (e: LadderEntry): PendingChallengeParty => ({
    userId: e.userId,
    name: e.name,
    image: e.image,
    playerSlug: e.playerSlug,
    rating: e.rating,
    position: e.position,
  })

  const out: PublicPendingChallenge[] = []
  for (const c of challenges) {
    const challenger = standByUser.get(c.challengerId)
    const challenged = standByUser.get(c.challengedId)
    if (!challenger || !challenged) continue
    const { ifWin, ifLose } = eloPreview(ladder.kFactor, challenger.rating, challenged.rating)
    out.push({
      id: c.id,
      challenger: toParty(challenger),
      challenged: toParty(challenged),
      ifWin,
      ifLose,
      proposedAt: c.proposedAt,
      respondByAt: c.respondByAt,
    })
  }
  return out
}

// ============================================================================
// Vista de la escalera para un viewer (preview ELO + estado de reto por fila)
// ============================================================================

export type LadderRowState = 'none' | 'sent' | 'received' | 'playing' | 'self'

/**
 * Actividad de reto/partido vivo de un jugador, desde la perspectiva del dueño de
 * la fila (global y pública — se ve aunque el viewer no esté involucrado). Una fila
 * puede tener varias. `ifWin`/`ifLose` son del dueño de la fila vs el rival.
 */
export interface LadderActivity {
  kind: 'sent' | 'received' | 'playing' // retó a / retado por / partido agendado
  rivalUserId: string
  rivalName: string
  rivalSlug: string | null
  rivalPosition: number // puesto del rival en la escalera
  ifWin: number
  ifLose: number
  scheduledAt: Date | null // solo 'playing'
  courtNumber: number | null
  matchId: string | null
}

export interface LadderRow extends LadderEntry {
  state: LadderRowState
  matchId: string | null // para 'playing': el partido a jugar (acción del viewer)
  ifWin: number | null // preview ELO vs el viewer (solo filas retables)
  ifLose: number | null
  activities: LadderActivity[] // actividad pública de ESTE jugador (todos sus retos vivos)
}

const KIND_ORDER: Record<LadderActivity['kind'], number> = { received: 0, playing: 1, sent: 2 }

function toPlainRow(e: LadderEntry): LadderRow {
  return { ...e, state: 'none', matchId: null, ifWin: null, ifLose: null, activities: [] }
}

/**
 * Ranking de la escalera enriquecido: por cada fila, la actividad PÚBLICA de retos/
 * partidos vivos de ese jugador (desde su perspectiva) + el preview ELO y el estado
 * del reto entre el viewer y la fila (para la acción del viewer). Todo server-side
 * (los ratings ya están en memoria) → sin requests por fila. `canChallenge` es true
 * solo si el viewer es miembro activo.
 */
export async function getLadderView(
  viewerUserId: string | null
): Promise<{ rows: LadderRow[]; canChallenge: boolean }> {
  const ranking = await getLadderRanking()
  if (ranking.length === 0) return { rows: [], canChallenge: false }

  const ladder = await getLadder()
  if (!ladder) return { rows: ranking.map(toPlainRow), canChallenge: false }

  // Lectura pública (también anónima): NO escribir acá. Filtramos los PROPOSED
  // vencidos por respondByAt en vez de expirarlos (que sería un updateMany en cada
  // GET de la home). El flip a EXPIRED lo hacen el cron diario y los write-paths
  // (crear/aceptar reto, bandeja).
  const allActive = await prisma.challenge.findMany({
    where: {
      ladderId: ladder.id,
      OR: [
        { status: 'PROPOSED', respondByAt: { gte: new Date() } },
        { status: 'ACCEPTED', match: { status: { in: ['PENDING', 'CONFIRMED'] } } },
      ],
    },
    select: {
      challengerId: true,
      challengedId: true,
      status: true,
      match: { select: { id: true, scheduledAt: true, courtNumber: true } },
    },
  })

  // Actividad pública por jugador: cada reto vivo aparece en las dos filas
  // implicadas, con los puntos desde la perspectiva del dueño de cada fila.
  const entryByUser = new Map(ranking.map((e) => [e.userId, e]))
  const activitiesByUser = new Map<string, LadderActivity[]>()
  const addActivity = (
    ownerId: string,
    rivalId: string,
    kind: LadderActivity['kind'],
    match: { id: string; scheduledAt: Date | null; courtNumber: number | null } | null
  ) => {
    const owner = entryByUser.get(ownerId)
    const rival = entryByUser.get(rivalId)
    if (!owner || !rival) return // alguno fuera del ranking (inactivo): no se muestra
    const { ifWin, ifLose } = eloPreview(ladder.kFactor, owner.rating, rival.rating)
    const list = activitiesByUser.get(ownerId) ?? []
    list.push({
      kind,
      rivalUserId: rivalId,
      rivalName: rival.name,
      rivalSlug: rival.playerSlug,
      rivalPosition: rival.position,
      ifWin,
      ifLose,
      scheduledAt: match?.scheduledAt ?? null,
      courtNumber: match?.courtNumber ?? null,
      matchId: match?.id ?? null,
    })
    activitiesByUser.set(ownerId, list)
  }
  for (const c of allActive) {
    if (c.status === 'ACCEPTED') {
      addActivity(c.challengerId, c.challengedId, 'playing', c.match)
      addActivity(c.challengedId, c.challengerId, 'playing', c.match)
    } else {
      addActivity(c.challengerId, c.challengedId, 'sent', null)
      addActivity(c.challengedId, c.challengerId, 'received', null)
    }
  }
  for (const list of activitiesByUser.values()) list.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
  const activitiesOf = (userId: string) => activitiesByUser.get(userId) ?? []

  // Sin viewer logueado: filas con actividad pública, sin acción.
  if (!viewerUserId) {
    return {
      rows: ranking.map((e) => ({ ...toPlainRow(e), activities: activitiesOf(e.userId) })),
      canChallenge: false,
    }
  }

  const viewer = await prisma.ladderMember.findUnique({
    where: { ladderId_userId: { ladderId: ladder.id, userId: viewerUserId } },
    select: { rating: true, isActive: true },
  })
  if (!viewer?.isActive) {
    // Logueado pero no miembro activo: actividad pública, sin retar.
    return {
      rows: ranking.map((e) => ({
        ...toPlainRow(e),
        state: e.userId === viewerUserId ? 'self' : 'none',
        activities: activitiesOf(e.userId),
      })),
      canChallenge: false,
    }
  }

  // Estado viewer-relativo (para la acción del viewer), derivado de allActive.
  const stateByRival = new Map<string, { state: Exclude<LadderRowState, 'none' | 'self'>; matchId: string | null }>()
  for (const c of allActive) {
    if (c.challengerId !== viewerUserId && c.challengedId !== viewerUserId) continue
    const rivalId = c.challengerId === viewerUserId ? c.challengedId : c.challengerId
    if (c.status === 'ACCEPTED') {
      stateByRival.set(rivalId, { state: 'playing', matchId: c.match?.id ?? null })
    } else {
      stateByRival.set(rivalId, { state: c.challengerId === viewerUserId ? 'sent' : 'received', matchId: null })
    }
  }

  const rows: LadderRow[] = ranking.map((e) => {
    const activities = activitiesOf(e.userId)
    if (e.userId === viewerUserId) {
      return { ...e, state: 'self', matchId: null, ifWin: null, ifLose: null, activities }
    }
    const st = stateByRival.get(e.userId)
    if (st) {
      return { ...e, state: st.state, matchId: st.matchId, ifWin: null, ifLose: null, activities }
    }
    // Fila retable: incluir el preview ELO del viewer.
    const { ifWin, ifLose } = eloPreview(ladder.kFactor, viewer.rating, e.rating)
    return { ...e, state: 'none', matchId: null, ifWin, ifLose, activities }
  })

  return { rows, canChallenge: true }
}

export interface MemberChallengeCard {
  id: string
  kind: 'sent' | 'received' | 'playing' // retó a / retado por / partido pactado
  rival: { userId: string; name: string; image: string | null; rating: number; position: number; playerSlug: string | null }
  ifWin: number // puntos desde la perspectiva del dueño del perfil
  ifLose: number
  respondByAt: Date | null // vencimiento (solo PROPOSED)
  scheduledAt: Date | null // fecha del partido (solo ACCEPTED/playing)
  matchId: string | null
}

/**
 * Retos/partidos vivos de un miembro, desde SU perspectiva — para la vista pública
 * del perfil (estilo bandeja, read-only). Mismo dato que ve el retado pero sin acciones.
 * Toma puesto/puntos/nombre/avatar del ranking (orden ya resuelto).
 */
export async function getMemberChallenges(userId: string): Promise<MemberChallengeCard[]> {
  const ladder = await getLadder()
  if (!ladder) return []
  await expireStaleChallenges(ladder.id)

  const ranking = await getLadderRanking()
  const standByUser = new Map(ranking.map((e) => [e.userId, e]))
  const me = standByUser.get(userId)
  if (!me) return [] // no es miembro activo

  const challenges = await prisma.challenge.findMany({
    where: {
      ladderId: ladder.id,
      OR: [{ challengerId: userId }, { challengedId: userId }],
      AND: {
        OR: [
          { status: 'PROPOSED' },
          { status: 'ACCEPTED', match: { status: { in: ['PENDING', 'CONFIRMED'] } } },
        ],
      },
    },
    select: {
      id: true,
      challengerId: true,
      challengedId: true,
      status: true,
      respondByAt: true,
      match: { select: { id: true, scheduledAt: true } },
    },
    orderBy: { proposedAt: 'asc' },
  })
  if (challenges.length === 0) return []

  const cards: MemberChallengeCard[] = []
  for (const c of challenges) {
    const isChallenger = c.challengerId === userId
    const rivalId = isChallenger ? c.challengedId : c.challengerId
    const rival = standByUser.get(rivalId)
    if (!rival) continue // rival inactivo / fuera de la escalera
    const { ifWin, ifLose } = eloPreview(ladder.kFactor, me.rating, rival.rating)
    cards.push({
      id: c.id,
      kind: c.status === 'ACCEPTED' ? 'playing' : isChallenger ? 'sent' : 'received',
      rival: {
        userId: rivalId,
        name: rival.name,
        image: rival.image,
        rating: rival.rating,
        position: rival.position,
        playerSlug: rival.playerSlug,
      },
      ifWin,
      ifLose,
      respondByAt: c.status === 'PROPOSED' ? c.respondByAt : null,
      scheduledAt: c.match?.scheduledAt ?? null,
      matchId: c.match?.id ?? null,
    })
  }
  cards.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
  return cards
}

export interface ChallengeStateInfo {
  state: LadderRowState
  matchId: string | null
  preview: { ifWin: number; ifLose: number } | null
}

/**
 * Estado del reto entre el viewer y un rival (para el botón del perfil/tabla):
 * none (+preview), sent, received, playing (+matchId), self. Devuelve null si el
 * viewer no puede retar (alguno no es miembro activo).
 */
export async function getChallengeState(viewerUserId: string, rivalUserId: string): Promise<ChallengeStateInfo | null> {
  if (viewerUserId === rivalUserId) return { state: 'self', matchId: null, preview: null }

  const ladder = await getLadder()
  if (!ladder) return null

  const [viewer, rival] = await Promise.all([
    prisma.ladderMember.findUnique({
      where: { ladderId_userId: { ladderId: ladder.id, userId: viewerUserId } },
      select: { rating: true, isActive: true },
    }),
    prisma.ladderMember.findUnique({
      where: { ladderId_userId: { ladderId: ladder.id, userId: rivalUserId } },
      select: { rating: true, isActive: true },
    }),
  ])
  if (!viewer?.isActive || !rival?.isActive) return null

  await expireStaleChallenges(ladder.id)

  const active = await prisma.challenge.findFirst({
    where: {
      ladderId: ladder.id,
      OR: [
        { challengerId: viewerUserId, challengedId: rivalUserId },
        { challengerId: rivalUserId, challengedId: viewerUserId },
      ],
      AND: {
        OR: [
          { status: 'PROPOSED' },
          { status: 'ACCEPTED', match: { status: { in: ['PENDING', 'CONFIRMED'] } } },
        ],
      },
    },
    select: { challengerId: true, status: true, matchId: true },
  })

  if (active) {
    if (active.status === 'ACCEPTED') return { state: 'playing', matchId: active.matchId, preview: null }
    return { state: active.challengerId === viewerUserId ? 'sent' : 'received', matchId: null, preview: null }
  }

  const { ifWin, ifLose } = eloPreview(ladder.kFactor, viewer.rating, rival.rating)
  return { state: 'none', matchId: null, preview: { ifWin, ifLose } }
}

export interface ChallengePreview {
  ifWin: number
  ifLose: number
  actorRating: number
  rivalRating: number
}

// ============================================================================
// Monitoreo de retos (admin)
// ============================================================================

export interface AdminChallengeRow {
  id: string
  challengerName: string
  challengerSlug: string | null
  challengedName: string
  challengedSlug: string | null
  proposedAt: Date
  respondByAt: Date
}

/** Retos PROPOSED vivos de la escalera (corre expiración perezosa antes de leer). */
export async function getLadderChallenges(ladderId: string): Promise<AdminChallengeRow[]> {
  await expireStaleChallenges(ladderId)
  const challenges = await prisma.challenge.findMany({
    where: { ladderId, status: 'PROPOSED' },
    include: {
      challenger: { select: { firstName: true, lastName: true } },
      challenged: { select: { firstName: true, lastName: true } },
    },
    orderBy: { proposedAt: 'asc' },
  })
  const slugMap = await getPlayerSlugsByUserIds(
    challenges.flatMap((c) => [c.challengerId, c.challengedId])
  )
  return challenges.map((c) => ({
    id: c.id,
    challengerName: fullName(c.challenger.firstName, c.challenger.lastName) || 'Jugador',
    challengerSlug: slugMap.get(c.challengerId) ?? null,
    challengedName: fullName(c.challenged.firstName, c.challenged.lastName) || 'Jugador',
    challengedSlug: slugMap.get(c.challengedId) ?? null,
    proposedAt: c.proposedAt,
    respondByAt: c.respondByAt,
  }))
}

/** Cancela un reto PROPOSED por intervención del admin (sin chequear el actor). */
export async function adminCancelChallenge(challengeId: string): Promise<void> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { status: true },
  })
  if (!challenge) throw new Error('Reto no encontrado.')
  if (challenge.status !== 'PROPOSED') throw new Error('Solo se pueden cancelar retos pendientes.')
  await prisma.challenge.update({
    where: { id: challengeId },
    data: { status: 'CANCELLED', respondedAt: new Date() },
  })
}

/** Preview ELO entre el actor y un rival (para el diálogo de retar/aceptar). */
export async function getChallengePreview(actorId: string, rivalId: string): Promise<ChallengePreview | null> {
  const ladder = await getLadder()
  if (!ladder) return null
  const [a, r] = await Promise.all([
    prisma.ladderMember.findUnique({
      where: { ladderId_userId: { ladderId: ladder.id, userId: actorId } },
      select: { rating: true },
    }),
    prisma.ladderMember.findUnique({
      where: { ladderId_userId: { ladderId: ladder.id, userId: rivalId } },
      select: { rating: true },
    }),
  ])
  if (!a || !r) return null
  const { ifWin, ifLose } = eloPreview(ladder.kFactor, a.rating, r.rating)
  return { ifWin, ifLose, actorRating: a.rating, rivalRating: r.rating }
}
