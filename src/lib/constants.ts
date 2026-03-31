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
