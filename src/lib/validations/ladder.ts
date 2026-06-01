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

// ============================================================================
// Config del Ladder (editor admin). seedBaseRating/seedStep quedan FUERA: solo
// aplican al sembrar y la escalera ya tiene miembros cuando se edita la config.
// matchFormat se limita a los formatos que la carga de resultado soporta hoy
// (BEST_OF_THREE todavía no está implementado en match-result-service).
// ============================================================================

const intField = (min: number, max: number) =>
  z.coerce.number().int('Debe ser un número entero').min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`)

export const ladderConfigSchema = z.object({
  kFactor: intField(1, 100),
  matchFormat: z.enum(['SINGLE_SET', 'TWO_SETS_SUPERTB']),
  maxOpenChallenges: intField(1, 20),
  maxChallengesPerMonth: intField(1, 50),
  acceptanceWindowDays: intField(1, 30),
  rematchCooldownDays: intField(0, 60),
  matchScheduleDeadlineDays: intField(1, 30),
  reservationLeadDays: intField(1, 120),
  minMatchesPerMonth: intField(0, 30),
  monthlyPenalty: intField(0, 500),
  ratingFloor: intField(0, 2000),
  monthlyWarningLeadDays: intField(1, 28),
})

export type LadderConfigInput = z.infer<typeof ladderConfigSchema>
