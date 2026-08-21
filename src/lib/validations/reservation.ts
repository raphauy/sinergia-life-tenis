import { z } from 'zod'

/**
 * Motivo por el que el admin rechaza una reserva pedida por un jugador. Va en el
 * email a los dos: antes el rechazo era mudo y el partido se quedaba sin plazo sin
 * que nadie se enterara.
 */
export const rejectReservationSchema = z.object({
  reservationId: z.string().min(1),
  reason: z.enum(['NO_COURT', 'CLASS', 'OTHER']),
})

export type RejectReservationInput = z.infer<typeof rejectReservationSchema>
export type RejectReservationReason = RejectReservationInput['reason']

/** Etiqueta corta para el menú del admin. */
export const REJECT_REASON_LABELS: Record<RejectReservationReason, string> = {
  NO_COURT: 'No hay cancha',
  CLASS: 'Horario de clase',
  OTHER: 'Otro motivo',
}

/** Cómo se cuenta el motivo en el email, en minúscula y en oración. */
export const REJECT_REASON_EMAIL_LABELS: Record<RejectReservationReason, string> = {
  NO_COURT: 'no hay cancha disponible a esa hora',
  CLASS: 'ese horario está tomado por una clase',
  OTHER: 'no se pudo tomar ese turno',
}
