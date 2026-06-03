import { prisma } from '@/lib/prisma'
import { fullName } from '@/lib/format-name'
import { getUserByEmail, createUser } from './user-service'
import { getLadder, getLadderRanking, getMember } from './ladder-service'
import { generateUniquePlayerSlug } from './player-service'
import { sendPlayerWelcomeEmail, generatePlayerPanelUrl } from './email-service'
import { LADDER_CONTAINER_SLUG } from '@/lib/constants'

// Torneo "contenedor" oculto que agrupa las fichas Player de los jugadores que
// entran directo por La Escalera (sin haber jugado un torneo real). Sirve solo
// para darles un slug → perfil público + operativa del jugador. No se lista como
// torneo: es isActive:false (lo excluye getActiveTournament) y getTournaments lo
// filtra por slug (LADDER_CONTAINER_SLUG vive en constants).
const LADDER_CONTAINER_NAME = 'La Escalera — ingreso directo'

// ============================================================================
// Solicitud pública
// ============================================================================

export async function createPlayerRegistration(data: {
  firstName: string
  lastName: string
  email: string
  whatsappNumber: string
  cedula: string
}) {
  const email = data.email.trim().toLowerCase()

  const existingUser = await getUserByEmail(email)
  if (existingUser) {
    // Mismo criterio que sendOtpAction: derivar a login o a contactar admin.
    throw new Error('Ese email ya tiene una cuenta. Iniciá sesión con tu email.')
  }

  const pending = await prisma.playerRegistration.findFirst({
    where: { email, status: 'PENDING' },
  })
  if (pending) {
    throw new Error('Ya tenés una solicitud pendiente. Esperá la aprobación del administrador.')
  }

  return prisma.playerRegistration.create({
    data: {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email,
      whatsappNumber: data.whatsappNumber.trim(),
      cedula: data.cedula.trim(),
    },
  })
}

// ============================================================================
// Lectura (admin)
// ============================================================================

export async function getPendingPlayerRegistrations() {
  return prisma.playerRegistration.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' }, // FIFO
  })
}

export async function getPendingPlayerRegistrationsCount(): Promise<number> {
  return prisma.playerRegistration.count({ where: { status: 'PENDING' } })
}

// ============================================================================
// Aprobar / rechazar (admin)
// ============================================================================

/** Get-or-create idempotente del torneo contenedor + su categoría "General". */
async function getOrCreateLadderContainer(): Promise<{ tournamentId: string; categoryId: string }> {
  const placeholder = new Date()
  const tournament = await prisma.tournament.upsert({
    where: { slug: LADDER_CONTAINER_SLUG },
    update: {},
    create: {
      name: LADDER_CONTAINER_NAME,
      slug: LADDER_CONTAINER_SLUG,
      isActive: false,
      startDate: placeholder,
      endDate: placeholder,
    },
  })
  const category = await prisma.tournamentCategory.upsert({
    where: { tournamentId_name: { tournamentId: tournament.id, name: 'General' } },
    update: {},
    create: { tournamentId: tournament.id, name: 'General' },
  })
  return { tournamentId: tournament.id, categoryId: category.id }
}

/**
 * Aprueba una solicitud: crea (o reutiliza) el User PLAYER, le da una ficha Player
 * en el torneo contenedor (con slug) y lo enrola en La Escalera con
 * rating = (rating del último miembro activo) − seedStep (piso = ratingFloor;
 * fallback seedBaseRating si la escalera no tiene miembros). El alta tiene gracia
 * mensual automática (joinedAt cae en el mes corriente). Manda email de bienvenida.
 */
export async function approvePlayerRegistration(registrationId: string, reviewedById: string) {
  const reg = await prisma.playerRegistration.findUnique({ where: { id: registrationId } })
  if (!reg) throw new Error('Solicitud no encontrada')
  if (reg.status !== 'PENDING') throw new Error('Esta solicitud ya fue procesada')

  const email = reg.email.trim().toLowerCase()
  const playerName = fullName(reg.firstName, reg.lastName) || 'Jugador'

  // 1) Resolver/crear User fuera de la transacción (idempotente por email).
  let user = await getUserByEmail(email)
  if (user && !user.isActive) {
    throw new Error('Ese email tiene una cuenta desactivada. Reactivala antes de aprobar.')
  }
  if (!user) {
    user = await createUser({
      email,
      firstName: reg.firstName,
      lastName: reg.lastName,
      role: 'PLAYER',
      phone: reg.whatsappNumber,
      cedula: reg.cedula,
    })
  }

  // 2) Escalera + rating inicial = último activo − seedStep (con piso y fallback).
  const ladder = await getLadder()
  if (!ladder) throw new Error('La Escalera todavía no fue sembrada.')
  const ranking = await getLadderRanking() // ordenado por rating desc → el último es el menor
  const last = ranking.at(-1)
  const base = last ? last.rating - ladder.seedStep : ladder.seedBaseRating
  const initialRating = Math.max(base, ladder.ratingFloor)

  // 3) Idempotencia: si ya es miembro, solo marcar la solicitud y salir.
  const existingMember = await getMember(user.id)
  if (existingMember) {
    await prisma.playerRegistration.update({
      where: { id: reg.id },
      data: { status: 'APPROVED', reviewedById, reviewedAt: new Date(), createdUserId: user.id },
    })
    return { rating: existingMember.rating, playerName, slug: null as string | null }
  }

  // 4) Ficha Player (torneo contenedor) con slug único.
  const { tournamentId, categoryId } = await getOrCreateLadderContainer()
  const slug = await generateUniquePlayerSlug(reg.firstName, reg.lastName)
  const userId = user.id

  // 5) Transacción corta: Player + LadderMember(+RatingHistory) + solicitud APPROVED.
  await prisma.$transaction(async (tx) => {
    await tx.player.create({
      data: {
        tournamentId,
        categoryId,
        userId,
        slug,
        firstName: reg.firstName,
        lastName: reg.lastName,
        email,
        whatsappNumber: reg.whatsappNumber,
        acceptedAt: new Date(),
      },
    })
    await tx.ladderMember.create({
      data: {
        ladderId: ladder.id,
        userId,
        rating: initialRating,
        ratingHistory: {
          create: {
            reason: 'ADJUSTMENT',
            ratingBefore: initialRating,
            ratingAfter: initialRating,
            delta: 0,
          },
        },
      },
    })
    await tx.playerRegistration.update({
      where: { id: reg.id },
      data: { status: 'APPROVED', reviewedById, reviewedAt: new Date(), createdUserId: userId },
    })
  })

  // 6) Email de bienvenida (no romper la aprobación si falla el envío).
  try {
    await sendPlayerWelcomeEmail({
      to: email,
      playerName,
      panelUrl: generatePlayerPanelUrl(slug),
      rating: initialRating,
    })
  } catch (err) {
    console.error('[registro] Falló el email de bienvenida (la cuenta ya fue creada):', err)
  }

  return { rating: initialRating, playerName, slug }
}

export async function rejectPlayerRegistration(registrationId: string, reviewedById: string) {
  const reg = await prisma.playerRegistration.findUnique({ where: { id: registrationId } })
  if (!reg) throw new Error('Solicitud no encontrada')
  if (reg.status !== 'PENDING') throw new Error('Esta solicitud ya fue procesada')

  return prisma.playerRegistration.update({
    where: { id: reg.id },
    data: { status: 'REJECTED', reviewedById, reviewedAt: new Date() },
  })
}
