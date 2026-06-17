/**
 * Arma una URL "Agendar en Google Calendar" pre-llenada (action=TEMPLATE).
 * `start` ya está en UTC (`Match.scheduledAt`); Google interpreta el sufijo `Z` como
 * UTC, así que no hay conversión de zona horaria. Duración fija: 1 hora (todos los
 * partidos del club duran lo mismo). Es una función pura → server o client.
 */
export function googleCalendarUrl(input: {
  start: Date
  title: string
  details?: string
  location?: string
  durationMinutes?: number
}): string {
  const { start, title, details, location, durationMinutes = 60 } = input
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  // Formato yyyymmddThhmmssZ exigido por Google.
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
  })
  if (details) params.set('details', details)
  if (location) params.set('location', location)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
