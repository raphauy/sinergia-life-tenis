import { prisma } from '@/lib/prisma'
import type { Role } from '@prisma/client'

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } })
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } })
}

export async function createUser(data: {
  email: string
  firstName?: string
  lastName?: string
  role: Role
  phone?: string
}) {
  return prisma.user.create({ data })
}

export async function updateUser(
  id: string,
  data: { firstName?: string; lastName?: string; image?: string | null; phone?: string; cedula?: string | null }
) {
  return prisma.user.update({ where: { id }, data })
}

export async function getAdminUsers() {
  return prisma.user.findMany({
    where: { role: { in: ['SUPERADMIN', 'ADMIN'] }, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      image: true,
      role: true,
      createdAt: true,
    },
  })
}

export async function removeAdminRole(userId: string, removedById: string) {
  const remover = await prisma.user.findUnique({ where: { id: removedById } })
  if (!remover || remover.role !== 'SUPERADMIN') {
    throw new Error('Solo los superadmins pueden eliminar administradores')
  }
  if (userId === removedById) {
    throw new Error('No puedes eliminarte a ti mismo')
  }
  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) throw new Error('Usuario no encontrado')
  if (target.role === 'SUPERADMIN') {
    throw new Error('No se puede eliminar a un superadmin')
  }
  if (target.role !== 'ADMIN') {
    throw new Error('El usuario no es administrador')
  }

  // Check if user has a player profile — if so, demote to PLAYER; otherwise deactivate
  const hasPlayer = await prisma.player.findFirst({
    where: { userId, isActive: true },
  })

  if (hasPlayer) {
    return prisma.user.update({ where: { id: userId }, data: { role: 'PLAYER' } })
  }
  return prisma.user.update({ where: { id: userId }, data: { role: 'PLAYER', isActive: false } })
}

export async function getPlayerSlugForUser(userId: string): Promise<string | null> {
  const player = await prisma.player.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { slug: true },
  })
  return player?.slug ?? null
}
