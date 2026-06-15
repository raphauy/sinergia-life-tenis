import { format, differenceInCalendarDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
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

/** Antigüedad en días de calendario UY: "hoy", "ayer", "hace N días". */
export function relativeDaysAgoUY(date: Date): string {
  const days = differenceInCalendarDays(toZonedTime(new Date(), TIMEZONE), toZonedTime(date, TIMEZONE))
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

/** Formatea fecha en español como "Sábado 9 de mayo" (sin año) */
export function longDateUY(date: Date): string {
  const dateUY = toZonedTime(date, TIMEZONE)
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${days[dateUY.getDay()]} ${dateUY.getDate()} de ${months[dateUY.getMonth()]}`
}

/** Convertir input UY → UTC para guardar en BD */
export function parseFromUY(dateStr: string, timeStr: string): Date {
  const dateTimeStr = `${dateStr}T${timeStr}:00`
  return fromZonedTime(dateTimeStr, TIMEZONE)
}

/** Límites UTC del mes calendario UY indicado (month: 1-12). */
export function monthRangeUY(year: number, month: number): { startUTC: Date; endUTC: Date } {
  const refDate = new Date(year, month - 1, 1)
  return {
    startUTC: fromZonedTime(startOfMonth(refDate), TIMEZONE),
    endUTC: fromZonedTime(endOfMonth(refDate), TIMEZONE),
  }
}

/** Año y mes (1-12) del mes calendario UY recién terminado respecto de ahora. */
export function previousMonthInUY(): { year: number; month: number } {
  const lastMonthUY = subMonths(toZonedTime(new Date(), TIMEZONE), 1)
  return { year: lastMonthUY.getFullYear(), month: lastMonthUY.getMonth() + 1 }
}

/**
 * Límites UTC de la semana calendario UY (lunes 00:00 → domingo 23:59) que
 * contiene `date`. El juego real es lunes–sábado (club cerrado domingo); la
 * atribución de partidos a una semana se hace por su `scheduledAt`.
 */
export function weekRangeUY(date: Date = new Date()): { startUTC: Date; endUTC: Date } {
  const dUY = toZonedTime(date, TIMEZONE)
  return {
    startUTC: fromZonedTime(startOfWeek(dUY, { weekStartsOn: 1 }), TIMEZONE),
    endUTC: fromZonedTime(endOfWeek(dUY, { weekStartsOn: 1 }), TIMEZONE),
  }
}

/** Límites UTC de la semana UY recién terminada (la anterior a la que contiene `date`). */
export function previousWeekRangeUY(date: Date = new Date()): { startUTC: Date; endUTC: Date } {
  // Restar 7 días exactos al instante UTC (UY no tiene DST) y dejar que weekRangeUY
  // haga la conversión a UY. NO pre-convertir con toZonedTime: weekRangeUY ya lo hace.
  return weekRangeUY(subWeeks(date, 1))
}

/** Días de calendario UY que faltan para fin del mes corriente (0 = hoy es el último día). */
export function daysUntilEndOfMonthUY(date: Date = new Date()): number {
  const dateUY = toZonedTime(date, TIMEZONE)
  return differenceInCalendarDays(endOfMonth(dateUY), dateUY)
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Etiqueta de mes en español, p.ej. "mayo de 2026" (month: 1-12). */
export function monthLabelUY(year: number, month: number): string {
  return `${MONTHS_ES[month - 1]} de ${year}`
}
