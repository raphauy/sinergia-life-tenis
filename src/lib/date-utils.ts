import { format, differenceInCalendarDays } from 'date-fns'
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

/** Fecha amigable: "Hoy 09:00 hs", "Mañana 15:30 hs", "Miércoles 19:30 hs", o "17/04 09:00 hs" */
export function friendlyDateTimeUY(date: Date): string {
  const time = `${formatTimeUY(date)} hs`
  const nowUY = toZonedTime(new Date(), TIMEZONE)
  const dateUY = toZonedTime(date, TIMEZONE)
  const diff = differenceInCalendarDays(dateUY, nowUY)
  if (diff === 0) return `Hoy ${time}`
  if (diff === 1) return `Mañana ${time}`
  if (diff >= 2 && diff <= 6) {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    return `${days[dateUY.getDay()]} ${time}`
  }
  return `${format(dateUY, 'dd/MM')} ${time}`
}

/** Convertir input UY → UTC para guardar en BD */
export function parseFromUY(dateStr: string, timeStr: string): Date {
  const dateTimeStr = `${dateStr}T${timeStr}:00`
  return fromZonedTime(dateTimeStr, TIMEZONE)
}
