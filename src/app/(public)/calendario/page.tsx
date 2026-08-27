import type { Metadata } from 'next'
import { getMonthMatches } from '@/services/match-service'
import { getReservationsByMonth, mapReservationToCalendar } from '@/services/reservation-service'
import { fullName } from '@/lib/format-name'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import { TIMEZONE, getLadderDaysForWeek, formatLadderDays } from '@/lib/constants'
import { getLadder } from '@/services/ladder-service'
import { toZonedTime } from 'date-fns-tz'
import { addDays } from 'date-fns'
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
  const [monthMatches, monthReservations, ladder] = await Promise.all([
    getMonthMatches(undefined, year, month),
    getReservationsByMonth(undefined, year, month),
    getLadder(),
  ])

  // Días alternantes de reserva de La Escalera (acuerdo con el club): se calculan
  // acá, en hora uruguaya, porque el calendario es un client component y en el
  // server la hora local es UTC. Sin escalera activa no se señaliza nada: esto es
  // estado real, no documentación (a diferencia de /escalera, que cae a los
  // defaults del schema para poder renderizar igual).
  const ladderReservation = ladder
    ? {
        leadDays: ladder.reservationLeadDays,
        daysThisWeek: formatLadderDays(getLadderDaysForWeek(nowUY)),
        daysNextWeek: formatLadderDays(getLadderDaysForWeek(addDays(nowUY, 7))),
      }
    : null

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
        ladderReservation={ladderReservation}
      />
    </div>
  )
}
