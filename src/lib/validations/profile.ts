import { z } from 'zod'

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  image: z.string().url().nullable().optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
