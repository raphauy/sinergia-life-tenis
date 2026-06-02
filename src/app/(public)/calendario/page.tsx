import type { Metadata } from 'next'
import { getMonthMatches } from '@/services/match-service'
import { getReservationsByMonth, mapReservationToCalendar } from '@/services/reservation-service'
import { fullName } from '@/lib/format-name'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import { TIMEZONE } from '@/lib/constants'
import { toZonedTime } from 'date-fns-tz'
import { CourtAvailabilityCalendar } from '@/components/court-availability-calendar'
import { fetchMonthMatchesPublicAction, fetchMonthReservationsPublicAction } from './actions'

export const metadata: Metadata = {
  title: 'Calendario',
  description: 'Disponibilidad de canchas y horarios de partidos',
}

export default async function CalendarioPage() {
  const nowUY = toZonedTime(new Date(), TIMEZONE)
  const year = nowUY.getFullYear()
  const month = nowUY.getMonth() + 1

  // Disponibilidad de canchas GLOBAL (tournamentId undefined): incluye partidos
  // y reservas de torneo + La Escalera, igual que el calendario del admin.
  const [monthMatches, monthReservations] = await Promise.all([
    getMonthMatches(undefined, year, month),
    getReservationsByMonth(undefined, year, month),
  ])

  const initialMatches = monthMatches.map((m) => ({
    scheduledAt: m.scheduledAt!.toISOString(),
    timeUY: formatTimeUY(m.scheduledAt!),
    dateUY: formatDateUY(m.scheduledAt!, 'yyyy-MM-dd'),
    courtNumber: m.courtNumber,
    player1Name: fullName(m.player1?.firstName, m.player1?.lastName),
    player2Name: fullName(m.player2?.firstName, m.player2?.lastName),
    categoryName: m.category?.name ?? '',
    groupNumber: m.group?.number ?? null,
  }))

  const initialReservations = monthReservations.map(mapReservationToCalendar)

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-1">Calendario</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Horarios de partidos confirmados y reservados. Tocá un día para ver el detalle.
      </p>
      <CourtAvailabilityCalendar
        initialMatches={initialMatches}
        initialReservations={initialReservations}
        tournamentId={undefined}
        initialYear={year}
        initialMonth={month}
        fetchAction={fetchMonthMatchesPublicAction}
        fetchReservationsAction={fetchMonthReservationsPublicAction}
      />
    </div>
  )
}
