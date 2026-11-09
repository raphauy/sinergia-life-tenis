import { z } from 'zod'
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from '@/lib/display-name'

/** Nombre para mostrar: trim, 2–20 caracteres; vacío = null (vuelve el nombre completo). */
export const displayNameSchema = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(
    z
      .string()
      .min(DISPLAY_NAME_MIN, `El nombre para mostrar debe tener al menos ${DISPLAY_NAME_MIN} caracteres`)
      .max(DISPLAY_NAME_MAX, `El nombre para mostrar puede tener hasta ${DISPLAY_NAME_MAX} caracteres`)
      .nullable()
  )

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'Nombre requerido').max(50),
  lastName: z.string().max(50).default(''),
  cedula: z.string().max(20).default(''),
  displayName: displayNameSchema.optional(),
  image: z.string().url().nullable().optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
