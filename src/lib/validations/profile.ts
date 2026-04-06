import { z } from 'zod'

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'Nombre requerido').max(50),
  lastName: z.string().max(50).default(''),
  cedula: z.string().max(20).default(''),
  image: z.string().url().nullable().optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
