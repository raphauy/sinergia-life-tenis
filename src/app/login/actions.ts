'use server'

import { signIn } from '@/lib/auth'
import { getUserByEmail, getPlayerSlugForUser } from '@/services/user-service'
import { generateOtp, createOtpToken } from '@/services/auth-service'
import { sendOtpEmail } from '@/services/email-service'
import { emailSchema } from '@/lib/validations/auth'
import { OTP_EXPIRATION_MINUTES } from '@/lib/constants'
import type { ActionResult } from '@/lib/action-types'
import { z } from 'zod'

export async function sendOtpAction(email: string): Promise<ActionResult> {
  try {
    const validatedEmail = emailSchema.parse(email)

    const user = await getUserByEmail(validatedEmail)
    if (!user) {
      return {
        success: false,
        error: 'Este email no está registrado en la plataforma. Si sos jugador del torneo, contactá al administrador.',
      }
    }

    if (!user.isActive) {
      return {
        success: false,
        error: 'Tu cuenta está desactivada. Contactá al administrador.',
      }
    }

    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000)
    await createOtpToken({ userId: user.id, token: otp, expiresAt })
    await sendOtpEmail({ to: validatedEmail, otp })

    return { success: true, message: 'Código enviado a tu email' }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Email inválido' }
    }
    console.error('Error sending OTP:', error)
    return { success: false, error: 'Error al enviar el código' }
  }
}

export async function verifyOtpAction(
  email: string,
  otp: string
): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    const validatedEmail = emailSchema.parse(email)

    if (!/^\d{6}$/.test(otp)) {
      return { success: false, error: 'El código debe ser de 6 dígitos' }
    }

    const user = await getUserByEmail(validatedEmail)
    if (!user) {
      return { success: false, error: 'Usuario no encontrado' }
    }

    const result = await signIn('credentials', {
      email: validatedEmail,
      otp,
      redirect: false,
    })

    if (result?.error) {
      return { success: false, error: 'Código inválido o expirado' }
    }

    // Redirect based on role
    let redirectUrl = '/admin'
    if (user.role === 'PLAYER') {
      const playerSlug = await getPlayerSlugForUser(user.id)
      redirectUrl = playerSlug ? `/jugador/${playerSlug}` : '/perfil'
    }

    return { success: true, data: { redirectUrl } }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Email inválido' }
    }
    console.error('Error verifying OTP:', error)
    return { success: false, error: 'Error al verificar el código' }
  }
}
