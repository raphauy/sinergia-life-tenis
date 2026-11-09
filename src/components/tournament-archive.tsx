import Link from 'next/link'
import { ChevronRight, Trophy } from 'lucide-react'
import { formatDateUY } from '@/lib/date-utils'
import type { getTournamentArchive } from '@/services/tournament-service'

type ArchiveTournament = Awaited<ReturnType<typeof getTournamentArchive>>[number]

/** Archivo de torneos al pie del home: una entrada por torneo. No se renderiza si no hay. */
export function TournamentArchive({ tournaments }: { tournaments: ArchiveTournament[] }) {
  if (tournaments.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold">Torneos</h2>
      <ul className="divide-y rounded-lg border">
        {tournaments.map((t) => (
          <li key={t.id}>
            <Link
              href={`/torneo/${t.slug}`}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
            >
              <Trophy className="h-4 w-4 text-primary shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block font-medium truncate">{t.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {/* Hoy todos los torneos son de singles; con Tournament.modality va "Dobles". */}
                  {formatDateUY(t.startDate)} · Singles
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
