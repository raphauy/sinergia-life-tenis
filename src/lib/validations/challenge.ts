import { z } from 'zod'

export const createChallengeSchema = z.object({
  challengedId: z.string().min(1, 'Falta el rival'),
})
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>

export const challengeIdSchema = z.object({
  challengeId: z.string().min(1),
})
