import { z } from 'zod'

// Días de calendario UY como string `yyyy-MM-dd` (el form manda esto; el service
// los convierte a límites de día UY en UTC con fromZonedTime + startOfDay/endOfDay).
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

export const protectionSchema = z
  .object({
    // Presente al editar un período existente; ausente al crear uno nuevo.
    protectionId: z.string().min(1).optional(),
    userId: z.string().min(1, 'Falta el jugador'),
    reason: z.enum(['INJURY', 'TRAVEL', 'OTHER']),
    note: z
      .union([z.string().trim().max(200, 'La nota no puede superar 200 caracteres'), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    startDate: dateStr,
    // Vacío / ausente = protección abierta (sin fin).
    endDate: z
      .union([dateStr, z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: 'La fecha de fin no puede ser anterior al inicio.',
    path: ['endDate'],
  })

export type ProtectionInput = z.infer<typeof protectionSchema>
