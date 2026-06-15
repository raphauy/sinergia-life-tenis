import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { relativeDaysAgoUY } from '@/lib/date-utils'
import type { Gallina } from '@/services/ladder-stats-service'

/** #N tenue del puesto actual (mismo estilo que el resto de la app). */
function Rank({ n }: { n: number | null }) {
  if (n == null) return null
  return <span className="shrink-0 text-xs text-muted-foreground tabular-nums">#{n}</span>
}

/** Nombre con link al perfil si hay slug. */
function PlayerName({ name, slug }: { name: string; slug: string | null }) {
  return slug ? (
    <Link href={`/jugador/${slug}`} className="font-medium hover:underline">
      {name}
    </Link>
  ) : (
    <span className="font-medium">{name}</span>
  )
}

/**
 * Sección Gallina: card desplegable (home, debajo de "Jugador de la semana") con quienes
 * rechazaron un reto parejo en los últimos 7 días. Una línea por gallina (rival más reciente
 * + "(+N)" si hubo varios) y la antigüedad del rechazo más reciente. Se oculta si está vacía.
 */
export function GallinaCard({ gallinas }: { gallinas: Gallina[] }) {
  if (gallinas.length === 0) return null
  const n = gallinas.length

  return (
    <Collapsible className="rounded-lg border bg-card">
      <CollapsibleTrigger className="group flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-left cursor-pointer transition-colors hover:bg-muted/50">
        <span className="shrink-0 text-lg leading-none" aria-hidden>
          🐔
        </span>
        <span className="flex-1 font-semibold">
          Sección Gallina{' '}
          <span className="font-normal text-muted-foreground">
            · {n} {n === 1 ? 'gallina' : 'gallinas'}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <ul className="space-y-3 pt-1">
          {gallinas.map((g) => {
            const extra = g.rejectedCount - 1
            return (
              <li key={g.userId} className="flex items-start gap-3">
                <Avatar className="mt-0.5 h-8 w-8 shrink-0">
                  <AvatarImage src={g.image || undefined} />
                  <AvatarFallback className="text-xs">{(g.name[0] || '?').toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
                    <PlayerName name={g.name} slug={g.playerSlug} />
                    <Rank n={g.position} />
                    <span className="text-muted-foreground">le rechazó a</span>
                    <PlayerName name={g.rival.name} slug={g.rival.playerSlug} />
                    <Rank n={g.rival.position} />
                    {extra > 0 && <span className="text-xs text-muted-foreground">(+{extra})</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{relativeDaysAgoUY(g.lastRejectedAt)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
