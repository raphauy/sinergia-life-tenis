import type { Metadata } from 'next'
import { getActiveTournament } from '@/services/tournament-service'
import { getMonthMatches } from '@/services/match-service'
import { fullName } from '@/lib/format-name'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import { TIMEZONE } from '@/lib/constants'
import { toZonedTime } from 'date-fns-tz'
import { CourtAvailabilityCalendar } from '@/components/court-availability-calendar'
import { fetchMonthMatchesPublicAction } from './actions'

export async function generateMetadata(): Promise<Metadata> {
  const tournament = await getActiveTournament()
  return {
    title: tournament ? `Calendario - ${tournament.name}` : 'Calendario',
    description: 'Disponibilidad de canchas y horarios de partidos',
  }
}

export default async function CalendarioPage() {
  const tournament = await getActiveTournament()

  if (!tournament) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Calendario</h1>
        <p className="text-muted-foreground">No hay torneo activo.</p>
      </div>
    )
  }

  const nowUY = toZonedTime(new Date(), TIMEZONE)
  const year = nowUY.getFullYear()
  const month = nowUY.getMonth() + 1

  const monthMatches = await getMonthMatches(tournament.id, year, month)
  const initialMatches = monthMatches.map((m) => ({
    scheduledAt: m.scheduledAt!.toISOString(),
    timeUY: formatTimeUY(m.scheduledAt!),
    dateUY: formatDateUY(m.scheduledAt!, 'yyyy-MM-dd'),
    courtNumber: m.courtNumber,
    player1Name: fullName(m.player1.firstName, m.player1.lastName),
    player2Name: fullName(m.player2.firstName, m.player2.lastName),
    categoryName: m.category.name,
    groupNumber: m.group?.number ?? null,
  }))

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-1">{tournament.name}</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Horarios de partidos confirmados. Tocá un día para ver el detalle.
      </p>
      <CourtAvailabilityCalendar
        initialMatches={initialMatches}
        tournamentId={tournament.id}
        initialYear={year}
        initialMonth={month}
        fetchAction={fetchMonthMatchesPublicAction}
      />
    </div>
  )
}
