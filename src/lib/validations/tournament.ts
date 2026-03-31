import { z } from 'zod'

export const createTournamentSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  description: z.string().max(500).optional(),
  startDate: z.string().min(1, 'Fecha de inicio requerida'),
  endDate: z.string().min(1, 'Fecha de fin requerida'),
  categories: z.array(z.string().min(1)).min(1, 'Al menos una categoría'),
})

export const updateTournamentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
})

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>
