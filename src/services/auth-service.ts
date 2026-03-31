import { prisma } from '@/lib/prisma'

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function createOtpToken(data: {
  userId: string
  token: string
  expiresAt: Date
}) {
  // Invalidate existing unused tokens
  await prisma.otpToken.updateMany({
    where: { userId: data.userId, usedAt: null },
    data: { usedAt: new Date() },
  })

  return prisma.otpToken.create({
    data: {
      userId: data.userId,
      token: data.token,
      expiresAt: data.expiresAt,
    },
  })
}

export async function verifyOtpToken(data: {
  userId: string
  token: string
}): Promise<boolean> {
  const otpToken = await prisma.otpToken.findFirst({
    where: {
      userId: data.userId,
      token: data.token,
      expiresAt: { gt: new Date() },
      usedAt: null,
    },
  })

  if (!otpToken) return false

  await prisma.otpToken.update({
    where: { id: otpToken.id },
    data: { usedAt: new Date() },
  })

  return true
}
