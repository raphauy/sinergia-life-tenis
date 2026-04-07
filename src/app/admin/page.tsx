import { getActiveTournament } from '@/services/tournament-service'
import { getMonthMatches } from '@/services/match-service'
import { getReservationsByMonth, mapReservationToCalendar } from '@/services/reservation-service'
import { fullName } from '@/lib/format-name'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import { TIMEZONE } from '@/lib/constants'
import { toZonedTime } from 'date-fns-tz'
import { AdminCalendar } from '@/components/admin-calendar'
import {
  fetchMonthMatchesAdminAction,
  fetchMonthReservationsAdminAction,
  searchPendingMatchesAction,
  confirmMatchFromCalendarAction,
  changeCourtFromCalendarAction,
  confirmReservationAction,
  rejectReservationAction,
} from './actions-calendar'
import { cancelMatchAction } from './partidos/actions'

export const metadata = {
  title: 'Dashboard',
}

export default async function AdminDashboardPage() {
  const tournament = await getActiveTournament()

  let calendarData = null
  if (tournament) {
    const nowUY = toZonedTime(new Date(), TIMEZONE)
    const year = nowUY.getFullYear()
    const month = nowUY.getMonth() + 1
    const [monthMatches, monthReservations] = await Promise.all([
      getMonthMatches(tournament.id, year, month),
      getReservationsByMonth(tournament.id, year, month),
    ])
    calendarData = {
      year,
      month,
      matches: monthMatches.map((m) => ({
        id: m.id,
        scheduledAt: m.scheduledAt!.toISOString(),
        timeUY: formatTimeUY(m.scheduledAt!),
        dateUY: formatDateUY(m.scheduledAt!, 'yyyy-MM-dd'),
        courtNumber: m.courtNumber,
        player1Name: fullName(m.player1.firstName, m.player1.lastName),
        player2Name: fullName(m.player2.firstName, m.player2.lastName),
        categoryName: m.category.name,
        groupNumber: m.group?.number ?? null,
      })),
      reservations: monthReservations.map(mapReservationToCalendar),
      tournamentId: tournament.id,
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground mt-1 mb-6">Panel de administración</p>

      {calendarData ? (
        <div className="max-w-lg">
          <AdminCalendar
            initialMatches={calendarData.matches}
            initialReservations={calendarData.reservations}
            tournamentId={calendarData.tournamentId}
            initialYear={calendarData.year}
            initialMonth={calendarData.month}
            fetchAction={fetchMonthMatchesAdminAction}
            fetchReservationsAction={fetchMonthReservationsAdminAction}
            searchAction={searchPendingMatchesAction}
            confirmAction={confirmMatchFromCalendarAction}
            confirmReservationAction={confirmReservationAction}
            rejectReservationAction={rejectReservationAction}
            cancelMatchAction={cancelMatchAction}
            changeCourtAction={changeCourtFromCalendarAction}
          />
        </div>
      ) : (
        <p className="text-muted-foreground">No hay torneo activo.</p>
      )}
    </div>
  )
}
