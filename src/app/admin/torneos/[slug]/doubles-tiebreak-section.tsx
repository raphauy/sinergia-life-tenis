'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { setGroupTiebreakOrderAction } from './actions'

export interface TiedGroup {
  groupId: string
  letter: string
  /** Posición del primero de los empatados (1 = el empate define 1°, 2° y 3°). */
  firstPosition: number
  pairs: { captainUserId: string; name: string }[]
}

/** Dobles: grupos terminados con un empate de 3+ parejas; el admin define el orden. */
export function DoublesTiebreakSection({ tournamentSlug, groups }: { tournamentSlug: string; groups: TiedGroup[] }) {
  if (groups.length === 0) return null
  return (
    <div className="mb-6 space-y-3">
      {groups.map((g) => (
        <TiedGroupCard key={g.groupId} tournamentSlug={tournamentSlug} group={g} />
      ))}
    </div>
  )
}

function TiedGroupCard({ tournamentSlug, group }: { tournamentSlug: string; group: TiedGroup }) {
  const [order, setOrder] = useState(group.pairs)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function move(index: number, delta: -1 | 1) {
    const next = [...order]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setOrder(next)
  }

  function save() {
    startTransition(async () => {
      const result = await setGroupTiebreakOrderAction(tournamentSlug, group.groupId, order.map((p) => p.captainUserId))
      if (result.success) {
        toast.success(`Orden del Grupo ${group.letter} definido`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
      <p className="font-semibold">Grupo {group.letter}: empate entre {order.length} parejas</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Tienen los mismos partidos ganados y la misma diferencia de games, y la tabla no lo puede resolver. Las semifinales
        de este grupo esperan hasta que definas el orden (1° → Copa de Oro, 2° → Copa de Plata).
      </p>
      <ol className="mb-3 space-y-1.5">
        {order.map((p, i) => (
          <li key={p.captainUserId} className="flex items-center gap-2 rounded border bg-background px-2 py-1.5 text-sm">
            <span className="w-6 font-bold tabular-nums">{group.firstPosition + i}°</span>
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, -1)} disabled={isPending || i === 0} aria-label={`Subir a ${p.name}`}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, 1)} disabled={isPending || i === order.length - 1} aria-label={`Bajar a ${p.name}`}>
              <ArrowDown className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ol>
      <Button size="sm" onClick={save} disabled={isPending}>
        {isPending ? 'Guardando...' : 'Guardar este orden'}
      </Button>
    </div>
  )
}
