'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Swords, CalendarClock, History, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDateUY, formatTimeUY } from '@/lib/date-utils'
import { cancelChallengeAdminAction } from './actions'
import { cancelLadderMatchAction } from '@/app/jugador/[slug]/escalera-actions'
import type { AdminChallengeRow } from '@/services/challenge-service'
import type { AdminLadderMatchRow } from '@/services/ladder-service'
import type { ActionResult } from '@/lib/action-types'

interface Props {
  challenges: AdminChallengeRow[]
  active: AdminLadderMatchRow[]
  played: AdminLadderMatchRow[]
}

// Nombre del jugador como link a su perfil (plano si no tiene slug).
function PlayerLink({ name, slug, className }: { name: string; slug: string | null; className?: string }) {
  if (!slug) return <span className={className}>{name}</span>
  return (
    <Link href={`/jugador/${slug}`} className={cn('hover:underline', className)}>
      {name}
    </Link>
  )
}

function matchStatusBadge(m: AdminLadderMatchRow) {
  if (m.status === 'CONFIRMED') {
    return <Badge className="border-green-300 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">Confirmado</Badge>
  }
  if (m.scheduledAt) {
    return <Badge className="border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">Reservado · a confirmar</Badge>
  }
  return <Badge variant="secondary">Sin reservar</Badge>
}

export function AdminLadderMonitor({ challenges, active, played }: Props) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  function run(id: string, action: () => Promise<ActionResult>, okMsg: string) {
    setPendingId(id)
    action().then((r) => {
      if (r.success) {
        toast.success(okMsg)
        setConfirmId(null)
        router.refresh()
      } else {
        toast.error(r.error || 'Ocurrió un error')
      }
      setPendingId(null)
    })
  }

  function CancelControl({ id, action, okMsg }: { id: string; action: () => Promise<ActionResult>; okMsg: string }) {
    if (confirmId === id) {
      return (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="destructive" size="sm" disabled={pendingId === id} onClick={() => run(id, action, okMsg)}>
            {pendingId === id ? '…' : 'Confirmar'}
          </Button>
          <Button variant="ghost" size="sm" disabled={pendingId === id} onClick={() => setConfirmId(null)}>
            No
          </Button>
        </div>
      )
    }
    return (
      <Button variant="outline" size="sm" className="shrink-0" onClick={() => setConfirmId(id)}>
        Cancelar
      </Button>
    )
  }

  return (
    <div className="space-y-6">
      {/* Retos pendientes de respuesta */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Swords className="h-4 w-4" /> Retos pendientes
          {challenges.length > 0 && <span className="text-muted-foreground">({challenges.length})</span>}
        </h3>
        {challenges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay retos esperando respuesta.</p>
        ) : (
          <div className="rounded-md border divide-y">
            {challenges.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    <PlayerLink name={c.challengerName} slug={c.challengerSlug} className="font-medium" /> retó a{' '}
                    <PlayerLink name={c.challengedName} slug={c.challengedSlug} className="font-medium" />
                  </p>
                  <p className="text-xs text-muted-foreground">vence {formatDateUY(c.respondByAt)}</p>
                </div>
                <CancelControl id={c.id} action={() => cancelChallengeAdminAction(c.id)} okMsg="Reto cancelado" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Partidos en curso */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4" /> Partidos en curso
          {active.length > 0 && <span className="text-muted-foreground">({active.length})</span>}
        </h3>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay partidos en curso.</p>
        ) : (
          <div className="rounded-md border divide-y">
            {active.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    <PlayerLink name={m.player1Name} slug={m.player1Slug} />{' '}
                    <span className="font-normal text-muted-foreground">vs</span>{' '}
                    <PlayerLink name={m.player2Name} slug={m.player2Slug} />
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {matchStatusBadge(m)}
                    {m.scheduledAt && (
                      <span>
                        {formatDateUY(m.scheduledAt)} · {formatTimeUY(m.scheduledAt)}
                        {m.courtNumber ? ` · Cancha ${m.courtNumber}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="outline" size="sm" render={<Link href={`/admin/partidos/${m.id}`} />}>
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                  <CancelControl id={m.id} action={() => cancelLadderMatchAction(m.id)} okMsg="Partido cancelado" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Historial de jugados */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4" /> Últimos jugados
        </h3>
        {played.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no se jugó ningún partido.</p>
        ) : (
          <div className="rounded-md border divide-y">
            {played.map((m) => {
              const winnerIsP1 = m.winnerName === m.player1Name
              const winnerSlug = winnerIsP1 ? m.player1Slug : m.player2Slug
              const loserName = winnerIsP1 ? m.player2Name : m.player1Name
              const loserSlug = winnerIsP1 ? m.player2Slug : m.player1Slug
              return (
              <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <p className="min-w-0 truncate text-sm">
                  {m.winnerName ? (
                    <>
                      <PlayerLink name={m.winnerName} slug={winnerSlug} className="font-medium" />
                      <span className="text-muted-foreground"> ganó a </span>
                      <PlayerLink name={loserName} slug={loserSlug} />
                    </>
                  ) : (
                    <span className="font-medium">{m.player1Name} vs {m.player2Name}</span>
                  )}
                </p>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  {m.walkover ? (
                    <Badge variant="secondary">W.O.</Badge>
                  ) : m.winnerDelta != null ? (
                    <span className="font-semibold tabular-nums text-green-600 dark:text-green-500">+{m.winnerDelta}</span>
                  ) : null}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
