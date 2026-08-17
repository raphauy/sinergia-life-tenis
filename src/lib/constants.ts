export const TIMEZONE = 'America/Montevideo'

export const APP_NAME = 'Life Tenis'

export const OTP_EXPIRATION_MINUTES = 10

export const INVITATION_EXPIRATION_DAYS = 7

export const MAX_IMAGE_SIZE = 4 * 1024 * 1024 // 4MB

export const COURTS = [
  { number: 1, name: 'Cancha 1' },
  { number: 2, name: 'Cancha 2' },
] as const

export const DEFAULT_CATEGORIES = ['A', 'B', 'C'] as const

// Slug del torneo "contenedor" oculto: agrupa las fichas Player de los jugadores
// que entran directo por La Escalera (auto-registro). Es un artefacto técnico,
// nunca se lista como torneo (getTournaments lo excluye). Ver player-registration-service.
export const LADDER_CONTAINER_SLUG = 'escalera-directa'

// Mañana: hora justa (7:00–11:00), Tarde: hora y media (12:30–20:30)
export const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:30', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30', '19:30', '20:30',
]

// Clases grupales que ocupan ambas canchas (day of week: 0=dom, 1=lun, ..., 6=sáb)
export const CLASS_SCHEDULE: Record<number, string[]> = {
  1: ['08:00'],             // lunes
  2: ['12:30'],             // martes
  3: ['08:00', '17:30', '18:30'], // miércoles
  4: ['12:30'],             // jueves
  5: ['17:30', '18:30'],    // viernes
  6: ['09:00', '10:00'],    // sábado
}

// Sábado solo mañana (cierra 13hs), domingo cerrado (excepto en dev)
const SATURDAY_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
]

// Días mínimos de adelanto para reservar (saltar 1 día hábil)
// Retorna la fecha mínima a partir de la cual se puede reservar
const MIN_RESERVATION_OFFSET: Record<number, number> = {
  0: 2, // dom → mar (+2)
  1: 2, // lun → mié (+2)
  2: 2, // mar → jue (+2)
  3: 2, // mié → vie (+2)
  4: 2, // jue → sáb (+2)
  5: 4, // vie → mar (+4, salta sáb/dom/lun)
  6: 3, // sáb → mar (+3, salta dom/lun)
}

export function getMinReservationDate(today: Date): Date {
  const offset = MIN_RESERVATION_OFFSET[today.getDay()] ?? 2
  const min = new Date(today)
  min.setDate(min.getDate() + offset)
  min.setHours(0, 0, 0, 0)
  return min
}

// Fecha máxima (inclusive) para reservar: hoy + leadDays días, fin del día.
// Cablea `Ladder.reservationLeadDays` (tope de anticipación). Para torneo no hay
// tope hoy (se pasa null y no se aplica).
export function getMaxReservationDate(today: Date, leadDays: number): Date {
  const max = new Date(today)
  max.setDate(max.getDate() + leadDays)
  max.setHours(23, 59, 59, 999)
  return max
}

export function getSlotsForDay(dayOfWeek: number): string[] {
  if (dayOfWeek === 0) {
    return process.env.NODE_ENV === 'development' ? TIME_SLOTS : []
  }
  if (dayOfWeek === 6) return SATURDAY_SLOTS
  return TIME_SLOTS
}

// Autoagendado ("ya tengo cancha"): días hacia atrás que se aceptan para cargar un
// partido de escalera ya jugado, con su resultado.
export const SELF_SCHEDULE_PAST_DAYS = 5

// Días alternantes de reserva anticipada de La Escalera (acuerdo con el club).
// Semana del lunes 17/08/2026 = paridad 0 (lun/mié/vie); la siguiente, paridad 1
// (mar/jue). La paridad la define la semana (lun-dom) de la FECHA DEL PARTIDO,
// no la de la reserva. Sábado habilitado siempre; domingo nunca (club cerrado).
// Solo restringe la reserva anticipada del jugador en escalera: el admin agenda
// cualquier día, y el autoagendado ("ya tengo cancha") tampoco pasa por acá.
const LADDER_WEEK_ANCHOR = new Date(2026, 7, 17)

const LADDER_ALTERNATING_DAYS: [number[], number[]] = [
  [1, 3, 5], // paridad 0: lunes, miércoles, viernes
  [2, 4], // paridad 1: martes, jueves
]

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Lunes (medianoche) de la semana que contiene la fecha. */
function mondayOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export function getLadderWeekParity(date: Date): 0 | 1 {
  // Ambos extremos son medianoches locales; el round absorbe saltos de DST.
  const diffDays = Math.round((mondayOfWeek(date).getTime() - LADDER_WEEK_ANCHOR.getTime()) / MS_PER_DAY)
  return (((Math.floor(diffDays / 7) % 2) + 2) % 2) as 0 | 1
}

/** ¿La escalera puede reservar con anticipación este día? */
export function isLadderReservableDay(date: Date): boolean {
  const dayOfWeek = date.getDay()
  if (dayOfWeek === 0) return false
  if (dayOfWeek === 6) return true
  return LADDER_ALTERNATING_DAYS[getLadderWeekParity(date)].includes(dayOfWeek)
}

/** Días (1-6) que la escalera puede reservar en la semana de la fecha dada. */
export function getLadderDaysForWeek(date: Date): number[] {
  return [...LADDER_ALTERNATING_DAYS[getLadderWeekParity(date)], 6]
}

const DAY_NAMES: Record<number, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
}

/** "lunes, miércoles, viernes y sábado" — para los mensajes de la UI. */
export function formatLadderDays(days: number[]): string {
  const names = days.map((d) => DAY_NAMES[d]).filter(Boolean)
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}
