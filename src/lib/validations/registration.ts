import { z } from 'zod'
import { emailSchema } from './auth'

// Auto-registro público de jugador nuevo (form de /registro).
export const playerRegistrationSchema = z.object({
  firstName: z.string().trim().min(1, 'Ingresá tu nombre'),
  lastName: z.string().trim().min(1, 'Ingresá tu apellido'),
  email: emailSchema,
  whatsappNumber: z.string().trim().min(6, 'Ingresá un WhatsApp válido'),
})

export type PlayerRegistrationInput = z.infer<typeof playerRegistrationSchema>
