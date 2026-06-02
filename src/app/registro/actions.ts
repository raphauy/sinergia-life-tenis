'use server'

import { createPlayerRegistration } from '@/services/player-registration-service'
import { playerRegistrationSchema } from '@/lib/validations/registration'
import type { ActionResult } from '@/lib/action-types'
import { z } from 'zod'

export async function submitPlayerRegistrationAction(data: {
  firstName: string
  lastName: string
  email: string
  whatsappNumber: string
}): Promise<ActionResult> {
  try {
    const parsed = playerRegistrationSchema.parse(data)
    await createPlayerRegistration(parsed)
    return {
      success: true,
      message: 'Tu solicitud quedó pendiente de aprobación. Te avisaremos por email cuando esté lista.',
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || 'Datos inválidos' }
    }
    const message = error instanceof Error ? error.message : 'Error al enviar el registro'
    return { success: false, error: message }
  }
}
