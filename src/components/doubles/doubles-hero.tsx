import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Trophy } from 'lucide-react'
import { formatTimeUY, longDateOnly } from '@/lib/date-utils'
import type { DoublesTournamentView } from '@/services/doubles-view-service'

/** "Dobles · sábado 14 de noviembre". */
export function doublesDateLine(startDate: Date): string {
  const date = longDateOnly(startDate)
  return `Dobles · ${date.charAt(0).toLowerCase()}${date.slice(1)}`
}

/** Estado del día en una línea: antes, durante o terminado el torneo. */
export function doublesDayStatus(view: DoublesTournamentView): string | null {
  const gold = view.cups.find((c) => c.cup === 'GOLD')
  if (gold?.champion) return null // el hero muestra a los campeones
  if (view.liveCount > 0) return `En juego · ${view.playedCount} de ${view.totalCount} partidos jugados`
  if (view.playedCount > 0) return `${view.playedCount} de ${view.totalCount} partidos jugados`
  if (view.firstMatchAt) return `Arranca a las ${formatTimeUY(view.firstMatchAt)} · ${view.groups.length} grupos, ${view.totalCount} partidos`
  return null
}

/** Hero compacto del home en modo torneo (velo negro 50 %, texto blanco). */
export function DoublesHero({
  name,
  startDate,
  view,
}: {
  name: string
  startDate: Date
  view: DoublesTournamentView
}) {
  const status = doublesDayStatus(view)
  const champions = view.cups.filter((c) => c.champion)
  return (
    <section className="relative h-44 overflow-hidden md:h-60">
      <Image src="/hero-dobles.jpg" alt={`${name}, torneo de dobles de Life Montevideo`} fill className="object-cover" priority />
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-90 md:text-sm">{doublesDateLine(startDate)}</p>
        <h1 className="text-3xl font-bold leading-tight md:text-4xl">{name}</h1>
        {champions.length > 0
          ? champions.map((c) => (
              <p key={c.cup} className="mt-1 flex items-center gap-1.5 text-sm md:text-base">
                <Trophy className={`h-4 w-4 shrink-0 ${c.cup === 'GOLD' ? 'text-yellow-300' : 'text-slate-200'}`} />
                <span>
                  {c.title}: <span className="font-bold">{c.champion!.shortName}</span>
                </span>
              </p>
            ))
          : status && <p className="mt-1.5 text-sm opacity-90 md:text-base">{status}</p>}
      </div>
    </section>
  )
}

/** Franja clickeable a La Escalera debajo del hero del modo torneo. */
export function LadderStrip() {
  return (
    <Link href="/?vista=escalera" className="block border-b bg-muted/40 transition-colors hover:bg-muted/70">
      <div className="container mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5 text-sm lg:max-w-5xl">
        <span>
          <span className="font-semibold">La Escalera sigue:</span>{' '}
          <span className="text-muted-foreground">ranking, retos y partidos</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
      </div>
    </Link>
  )
}
