import { prisma } from '@/lib/prisma'
import type { Role } from '@/generated/prisma/client'

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } })
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } })
}

export async function createUser(data: {
  email: string
  name?: string
  role: Role
  phone?: string
}) {
  return prisma.user.create({ data })
}

export async function updateUser(
  id: string,
  data: { name?: string; image?: string | null; phone?: string }
) {
  return prisma.user.update({ where: { id }, data })
}

export async function getPlayerIdForUser(userId: string): Promise<string | null> {
  const player = await prisma.player.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  return player?.id ?? null
}
