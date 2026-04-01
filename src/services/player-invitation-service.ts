import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import {
  sendPlayerInvitationEmail,
  generatePlayerInviteUrl,
} from './email-service'

export async function invitePlayer(playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      tournament: { select: { name: true } },
      category: { select: { name: true } },
    },
  })

  if (!player) throw new Error('Jugador no encontrado')
  if (!player.email) throw new Error('El jugador no tiene email')

  const token = crypto.randomBytes(32).toString('hex')

  await prisma.player.update({
    where: { id: playerId },
    data: {
      invitationToken: token,
      invitedAt: new Date(),
    },
  })

  const acceptUrl = generatePlayerInviteUrl(token)
  console.log(`[Invite] ${player.firstName} ${player.lastName} → ${acceptUrl}`)

  await sendPlayerInvitationEmail({
    to: player.email,
    playerName: player.firstName,
    tournamentName: player.tournament.name,
    categoryName: player.category.name,
    acceptUrl,
  })
}

export async function acceptPlayerInvitation(token: string) {
  const player = await prisma.player.findFirst({
    where: { invitationToken: token },
    include: { tournament: true, category: true },
  })

  if (!player) throw new Error('Invitación no encontrada')
  if (player.acceptedAt) throw new Error('Esta invitación ya fue aceptada')
  if (!player.email) throw new Error('El jugador no tiene email')

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email: player.email } })

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: player.email,
        firstName: player.firstName,
        lastName: player.lastName,
        phone: player.whatsappNumber,
        role: 'PLAYER',
      },
    })
  }

  // Link player to user
  await prisma.player.update({
    where: { id: player.id },
    data: {
      userId: user.id,
      acceptedAt: new Date(),
      invitationToken: null,
    },
  })

  return { player, user }
}

export async function forceAcceptPlayer(playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
  })

  if (!player) throw new Error('Jugador no encontrado')
  if (player.acceptedAt) throw new Error('El jugador ya fue aceptado')
  if (!player.email) throw new Error('El jugador no tiene email')

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email: player.email } })

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: player.email,
        firstName: player.firstName,
        lastName: player.lastName,
        phone: player.whatsappNumber,
        role: 'PLAYER',
      },
    })
  }

  // Link player to user (keep invitationToken so the email link still works)
  await prisma.player.update({
    where: { id: player.id },
    data: {
      userId: user.id,
      acceptedAt: new Date(),
    },
  })

  return { player, user }
}

export async function getPlayerByInvitationToken(token: string) {
  return prisma.player.findFirst({
    where: { invitationToken: token },
    include: {
      tournament: { select: { name: true } },
      category: { select: { name: true } },
    },
  })
}
