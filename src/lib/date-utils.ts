import { format } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { TIMEZONE } from './constants'

/** Convertir UTC → UY para mostrar en UI */
export function formatDateUY(date: Date, fmt: string = 'dd/MM/yyyy') {
  return format(toZonedTime(date, TIMEZONE), fmt)
}

/** Formatear hora en UY */
export function formatTimeUY(date: Date) {
  return format(toZonedTime(date, TIMEZONE), 'HH:mm')
}

/** Formatear fecha+hora en UY */
export function formatDateTimeUY(date: Date) {
  return format(toZonedTime(date, TIMEZONE), 'dd/MM/yyyy HH:mm')
}

/** Convertir input UY → UTC para guardar en BD */
export function parseFromUY(dateStr: string, timeStr: string): Date {
  const dateTimeStr = `${dateStr}T${timeStr}:00`
  return fromZonedTime(dateTimeStr, TIMEZONE)
}
