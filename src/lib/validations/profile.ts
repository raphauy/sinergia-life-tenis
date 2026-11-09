import { z } from 'zod'
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from '@/lib/display-name'

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'Nombre requerido').max(50),
  lastName: z.string().max(50).default(''),
  cedula: z.string().max(20).default(''),
  // Vacío = null: vuelve a mostrarse el nombre completo.
  displayName: z
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
    .optional(),
  image: z.string().url().nullable().optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
