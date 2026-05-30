import { z } from 'zod'

const seedCommitItemSchema = z
  .object({
    playerId: z.string().min(1),
    userId: z.string().min(1).nullable(),
    email: z
      .union([z.string().trim().email('Email inválido'), z.literal(''), z.null()])
      .transform((v) => (v ? v : null)),
    firstName: z.string(),
    lastName: z.string(),
  })
  .refine((it) => it.userId != null || it.email != null, {
    message: 'Hay jugadores sin cuenta y sin email. Completá el email o quitalos.',
  })

export const seedCommitSchema = z.object({
  items: z.array(seedCommitItemSchema).min(1, 'No hay jugadores para sembrar'),
})

export type SeedCommitInput = z.infer<typeof seedCommitSchema>
