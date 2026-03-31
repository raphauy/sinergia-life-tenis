import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import {
  sendAdminInvitationEmail,
  generateAdminInviteUrl,
} from './email-service'
import { INVITATION_EXPIRATION_DAYS } from '@/lib/constants'

export async function createAdminInvitation(data: {
  email: string
  name?: string
  invitedById: string
}) {
  // Verify inviter is SUPERADMIN
  const inviter = await prisma.user.findUnique({ where: { id: data.invitedById } })
  if (!inviter || inviter.role !== 'SUPERADMIN') {
    throw new Error('Solo los superadmins pueden invitar administradores')
  }

  // Check if already admin
  const existing = await prisma.user.findUnique({ where: { email: data.email } })
  if (existing && (existing.role === 'ADMIN' || existing.role === 'SUPERADMIN')) {
    throw new Error('Este usuario ya es administrador')
  }

  // Check pending invitation
  const pendingInvite = await prisma.adminInvitation.findFirst({
    where: {
      email: data.email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  })
  if (pendingInvite) {
    throw new Error('Ya existe una invitación pendiente para este email')
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRATION_DAYS)

  const invitation = await prisma.adminInvitation.create({
    data: {
      email: data.email,
      name: data.name,
      token,
      expiresAt,
      invitedById: data.invitedById,
    },
    include: {
      invitedBy: { select: { name: true, email: true } },
    },
  })

  const acceptUrl = generateAdminInviteUrl(token)
  try {
    await sendAdminInvitationEmail({
      to: data.email,
      inviterName: invitation.invitedBy.name || invitation.invitedBy.email,
      acceptUrl,
    })
  } catch {
    // Rollback invitation if email fails
    await prisma.adminInvitation.delete({ where: { id: invitation.id } })
    throw new Error('Error al enviar el email de invitación')
  }

  return invitation
}

export async function acceptAdminInvitation(token: string) {
  const invitation = await prisma.adminInvitation.findUnique({ where: { token } })
  if (!invitation) throw new Error('Invitación no encontrada')
  if (invitation.expiresAt < new Date()) throw new Error('La invitación ha expirado')
  if (invitation.acceptedAt) throw new Error('Esta invitación ya fue aceptada')

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email: invitation.email } })

  if (user) {
    // Promote existing user to ADMIN
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'ADMIN',
        ...(invitation.name && !user.name ? { name: invitation.name } : {}),
      },
    })
  } else {
    user = await prisma.user.create({
      data: {
        email: invitation.email,
        name: invitation.name,
        role: 'ADMIN',
      },
    })
  }

  await prisma.adminInvitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  })

  return user
}

export async function getAdminInvitationByToken(token: string) {
  return prisma.adminInvitation.findUnique({
    where: { token },
    include: { invitedBy: { select: { name: true, email: true } } },
  })
}

export async function getPendingAdminInvitations() {
  return prisma.adminInvitation.findMany({
    where: { acceptedAt: null, expiresAt: { gt: new Date() } },
    include: { invitedBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function cancelAdminInvitation(id: string) {
  return prisma.adminInvitation.delete({ where: { id } })
}

export async function resendAdminInvitation(id: string) {
  const invitation = await prisma.adminInvitation.findUnique({
    where: { id },
    include: { invitedBy: { select: { name: true, email: true } } },
  })
  if (!invitation) throw new Error('Invitación no encontrada')
  if (invitation.acceptedAt) throw new Error('Esta invitación ya fue aceptada')
  if (invitation.expiresAt < new Date()) throw new Error('La invitación ha expirado')

  const acceptUrl = generateAdminInviteUrl(invitation.token)
  await sendAdminInvitationEmail({
    to: invitation.email,
    inviterName: invitation.invitedBy.name || invitation.invitedBy.email,
    acceptUrl,
  })
}
