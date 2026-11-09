import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { formatTimeUY } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type {
  DoublesCupView,
  DoublesGroupView,
  DoublesMatchView,
  DoublesTournamentView,
} from '@/services/doubles-view-service'
import { DoublesMatchRow, PairName } from './doubles-match-row'

/** Vista de un torneo de dobles: Definición (arriba si ya hay parejas en semis, si no al pie) y los grupos. */
export function DoublesTournamentBody({ view }: { view: DoublesTournamentView }) {
  const definition = view.cups.length > 0 ? <DoublesDefinition cups={view.cups} /> : null
  return (
    <div className="space-y-8">
      {view.definitionStarted && definition}
      {view.groups.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          {view.groups.map((g) => (
            <DoublesGroupCard key={g.id} group={g} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Todavía no hay grupos cargados.</p>
      )}
      {!view.definitionStarted && definition}
    </div>
  )
}

export function DoublesGroupCard({ group }: { group: DoublesGroupView }) {
  const anyDecided = group.standings.some((s) => s.decided)
  return (
    <section className="overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between bg-orange-100 px-4 py-2 dark:bg-orange-950">
        <h3 className="font-bold">Grupo {group.letter}</h3>
        <span className="text-xs text-muted-foreground">
          {group.played}/{group.total} jugados
        </span>
      </div>
      <table className="w-full table-fixed text-sm">
        <thead className="text-[11px] text-muted-foreground">
          <tr>
            <th className="w-7 py-1.5 pl-3 text-left font-medium">#</th>
            <th className="text-left font-medium">Pareja</th>
            <th className="w-8 font-medium">PJ</th>
            <th className="w-8 font-medium">PG</th>
            <th className="w-10 pr-2 font-medium">DG</th>
          </tr>
        </thead>
        <tbody>
          {group.standings.map((s) => (
            <tr key={s.pair.slug} className={cn('border-t', s.decided && 'bg-primary/10')}>
              <td className="py-1.5 pl-3 font-bold">{s.position}</td>
              <td className="truncate py-1.5 pr-1">
                <Link href={`/pareja/${s.pair.slug}`} className="font-medium hover:underline">
                  {s.pair.shortName}
                </Link>
              </td>
              <td className="text-center tabular-nums">{s.pj}</td>
              <td className="text-center font-semibold tabular-nums">{s.pg}</td>
              <td className="pr-2 text-center tabular-nums">{s.pj ? (s.dg > 0 ? `+${s.dg}` : s.dg) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={cn('border-t px-3 py-1 text-[11px] text-muted-foreground', anyDecided && 'text-foreground')}>
        1° → Copa de Oro, 2° → Copa de Plata
      </p>
      <div className="space-y-1.5 border-t bg-muted/20 p-2">
        {group.matches.map((m) => (
          <DoublesMatchRow key={m.id} match={m} />
        ))}
      </div>
    </section>
  )
}

/** Definición: un cuadro por copa, apilados (Oro arriba). Cada uno: 2 semis + final. */
export function DoublesDefinition({ cups }: { cups: DoublesCupView[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Definición</h2>
      <div className="space-y-5">
        {cups.map((c) => (
          <div key={c.cup}>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
              <Trophy className={cn('h-4 w-4', c.cup === 'GOLD' ? 'text-yellow-500' : 'text-slate-400')} />
              {c.title}
              {c.champion && (
                <span className="ml-1 font-normal text-muted-foreground">
                  · Campeones: <PairName pair={c.champion} className="font-bold text-foreground" />
                </span>
              )}
            </h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {c.semis.map((m) => (
                <BracketCard key={m.id} match={m} title={`Semifinal ${m.bracketPosition ?? ''}`.trim()} />
              ))}
              {c.final && <BracketCard match={c.final} title="Final" highlight />}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function BracketCard({ match, title, highlight }: { match: DoublesMatchView; title: string; highlight?: boolean }) {
  const played = match.score != null
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        highlight && 'border-primary bg-primary/5',
        match.live && 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
      )}
    >
      <Link
        href={`/partido/${match.id}`}
        className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground hover:opacity-80"
      >
        <span className="font-bold text-primary/80">{title}</span>
        <span className={cn(match.live && 'font-bold text-red-600 dark:text-red-400')}>
          {match.live ? 'En juego · ' : ''}
          {match.scheduledAt ? formatTimeUY(match.scheduledAt) : ''}
          {match.courtNumber != null ? ` · C${match.courtNumber}` : ''}
        </span>
      </Link>
      {([1, 2] as const).map((side) => (
        <div key={side} className={cn('flex items-center justify-between gap-2 py-1 text-sm', side === 1 && 'border-b')}>
          <span className="min-w-0 truncate">
            <PairName
              pair={side === 1 ? match.side1 : match.side2}
              slot={side === 1 ? match.slot1 : match.slot2}
              played={played}
              winner={match.winnerSide === side}
            />
          </span>
          {played && match.winnerSide === side && <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />}
        </div>
      ))}
      {played && (
        <Link href={`/partido/${match.id}`} className="mt-1 block text-right text-sm font-bold tabular-nums hover:opacity-80">
          {match.score}
        </Link>
      )}
    </div>
  )
}
