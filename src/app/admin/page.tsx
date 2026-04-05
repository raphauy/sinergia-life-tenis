import { getActiveTournament } from '@/services/tournament-service'
import { getMonthMatches } from '@/services/match-service'
import { fullName } from '@/lib/format-name'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import { TIMEZONE } from '@/lib/constants'
import { toZonedTime } from 'date-fns-tz'
import { AdminCalendar } from '@/components/admin-calendar'
import {
  fetchMonthMatchesAdminAction,
  searchPendingMatchesAction,
  confirmMatchFromCalendarAction,
} from './actions-calendar'

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
    const monthMatches = await getMonthMatches(tournament.id, year, month)
    calendarData = {
      year,
      month,
      matches: monthMatches.map((m) => ({
        scheduledAt: m.scheduledAt!.toISOString(),
        timeUY: formatTimeUY(m.scheduledAt!),
        dateUY: formatDateUY(m.scheduledAt!, 'yyyy-MM-dd'),
        courtNumber: m.courtNumber,
        player1Name: fullName(m.player1.firstName, m.player1.lastName),
        player2Name: fullName(m.player2.firstName, m.player2.lastName),
        categoryName: m.category.name,
        groupNumber: m.group?.number ?? null,
      })),
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
            tournamentId={calendarData.tournamentId}
            initialYear={calendarData.year}
            initialMonth={calendarData.month}
            fetchAction={fetchMonthMatchesAdminAction}
            searchAction={searchPendingMatchesAction}
            confirmAction={confirmMatchFromCalendarAction}
          />
        </div>
      ) : (
        <p className="text-muted-foreground">No hay torneo activo.</p>
      )}
    </div>
  )
}
