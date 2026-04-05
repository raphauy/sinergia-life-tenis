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

export function getSlotsForDay(dayOfWeek: number): string[] {
  if (dayOfWeek === 0) {
    return process.env.NODE_ENV === 'development' ? TIME_SLOTS : []
  }
  if (dayOfWeek === 6) return SATURDAY_SLOTS
  return TIME_SLOTS
}
