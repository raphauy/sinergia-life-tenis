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

// Mañana: hora justa (7:00–12:00), Tarde: hora y media (12:30–20:30)
export const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:30', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30', '19:30', '20:30',
]
