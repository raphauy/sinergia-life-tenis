import { z } from 'zod'

export const createMatchSchema = z
  .object({
    tournamentId: z.string().min(1, 'Torneo requerido'),
    categoryId: z.string().min(1, 'Categoría requerida'),
    player1Id: z.string().min(1, 'Jugador 1 requerido'),
    player2Id: z.string().min(1, 'Jugador 2 requerido'),
    courtNumber: z.coerce.number().int().min(1).max(2).optional(),
    date: z.string().optional(),
    time: z.string().optional(),
  })
  .refine((d) => d.player1Id !== d.player2Id, {
    message: 'Los jugadores deben ser distintos',
    path: ['player2Id'],
  })
  .refine((d) => !(d.date && !d.time) && !(!d.date && d.time), {
    message: 'Si se ingresa fecha o hora, ambos son obligatorios',
    path: ['date'],
  })

export const confirmMatchSchema = z.object({
  date: z.string().min(1, 'Fecha requerida'),
  time: z.string().min(1, 'Hora requerida'),
  courtNumber: z.coerce.number().int().min(1).max(2, 'Cancha debe ser 1 o 2'),
})

// Autoagendado de escalera: el jugador ya consiguió cancha por su cuenta.
export const selfScheduleMatchSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida'),
    location: z.enum(['CLUB', 'EXTERNAL']),
    courtNumber: z.coerce.number().int().min(1).max(2).optional(),
  })
  .refine((d) => d.location === 'EXTERNAL' || d.courtNumber != null, {
    message: 'Elegí la cancha',
    path: ['courtNumber'],
  })

export type CreateMatchInput = z.infer<typeof createMatchSchema>
export type ConfirmMatchInput = z.infer<typeof confirmMatchSchema>
export type SelfScheduleMatchInput = z.infer<typeof selfScheduleMatchSchema>
