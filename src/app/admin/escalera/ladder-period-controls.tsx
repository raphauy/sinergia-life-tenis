'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarCheck, RefreshCw, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { closeMonthAction, runDailyTasksAction, revertPenaltyAction } from './actions'
import type { PenaltyRow } from '@/services/ladder-service'

interface MonthOption {
  value: string // "YYYY-M"
  label: string
}

interface Props {
  lastClose: { label: string; closedAtLabel: string } | null
  monthOptions: MonthOption[]
  defaultMonth: string
  /** Multas aplicadas por período ("YYYY-M"); un mes sin cierre no está en el objeto. */
  penaltiesByPeriod: Record<string, PenaltyRow[]>
}

export function LadderPeriodControls({ lastClose, monthOptions, defaultMonth, penaltiesByPeriod }: Props) {
  const router = useRouter()
  const [period, setPeriod] = useState(defaultMonth)
  const [confirm, setConfirm] = useState(false)
  const [confirmRevertId, setConfirmRevertId] = useState<string | null>(null)
  const [closing, startClose] = useTransition()
  const [running, startRun] = useTransition()
  const [reverting, startRevert] = useTransition()

  const penalties = penaltiesByPeriod[period] ?? []
  const periodLabel = monthOptions.find((o) => o.value === period)?.label ?? period
  // El Record trae TODOS los períodos cerrados (lista vacía si no hubo penalizados).
  const isClosed = period in penaltiesByPeriod

  function doRevert(p: PenaltyRow) {
    const [y, m] = period.split('-').map(Number)
    startRevert(async () => {
      const res = await revertPenaltyAction(p.historyId, y, m)
      if (res.success) {
        toast.success(res.message ?? 'Penalización revertida.')
        setConfirmRevertId(null)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function doClose() {
    const [y, m] = period.split('-').map(Number)
    startClose(async () => {
      const res = await closeMonthAction(y, m)
      if (res.success) {
        toast.success(res.message ?? 'Mes cerrado.')
        setConfirm(false)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function doRun() {
    startRun(async () => {
      const res = await runDailyTasksAction()
      if (res.success) {
        toast.success(res.message ?? 'Listo.')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <CalendarCheck className="h-4 w-4" /> Cierre de período
      </h3>
      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm text-muted-foreground">
          {lastClose
            ? `Último cierre: ${lastClose.label} · ${lastClose.closedAtLabel}`
            : 'Todavía no se cerró ningún mes.'}
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Mes a cerrar</label>
            <Select value={period} onValueChange={(v) => v && setPeriod(v)} items={monthOptions}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {confirm ? (
            <div className="flex items-center gap-1.5">
              <Button variant="destructive" size="sm" disabled={closing} onClick={doClose}>
                {closing ? 'Cerrando…' : 'Confirmar cierre'}
              </Button>
              <Button variant="ghost" size="sm" disabled={closing} onClick={() => setConfirm(false)}>
                No
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setConfirm(true)}>
              Cerrar mes
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Aplica la multa de puntos a quien no llegó al mínimo ese mes. Es idempotente: re-cerrar un mes ya cerrado no
          hace nada.
        </p>

        {isClosed && (
          <div className="border-t pt-3">
            {penalties.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nadie fue penalizado en {periodLabel}.</p>
            ) : (
              <>
                <p className="mb-2 text-xs font-medium">
                  Penalizados en {periodLabel} ({penalties.length})
                </p>
                <div className="divide-y overflow-hidden rounded-md border">
                  {penalties.map((p) => (
                    <div
                      key={p.historyId}
                      className="flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                    >
                      <div className="min-w-0">
                        {p.playerSlug ? (
                          <Link href={`/jugador/${p.playerSlug}`} className="block truncate text-sm font-medium hover:underline">
                            {p.name}
                          </Link>
                        ) : (
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          <span className="text-red-600 dark:text-red-500">−{p.points} pts</span> · quedó en {p.ratingAfter}
                          {p.currentRating !== p.ratingAfter && ` · hoy ${p.currentRating}`}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                        {confirmRevertId === p.historyId ? (
                          <>
                            <Button size="sm" disabled={reverting} onClick={() => doRevert(p)}>
                              {reverting ? 'Revirtiendo…' : `Devolver ${p.points} pts`}
                            </Button>
                            <Button variant="ghost" size="sm" disabled={reverting} onClick={() => setConfirmRevertId(null)}>
                              No
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setConfirmRevertId(p.historyId)}>
                            <Undo2 className="h-4 w-4" /> Revertir
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Revertir devuelve los puntos y borra la multa del historial, como si el cierre nunca lo hubiera
                  penalizado. Le llega un email avisándole.
                </p>
              </>
            )}
          </div>
        )}

        <div className="border-t pt-3">
          <Button variant="outline" size="sm" disabled={running} onClick={doRun}>
            <RefreshCw className="h-4 w-4" />
            {running ? 'Corriendo…' : 'Correr tareas diarias'}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            Expira retos vencidos, libera reservas cuyo turno pasó sin confirmar, avisa/auto-cancela partidos sin reservar y manda el aviso pre-cierre.
          </p>
        </div>
      </div>
    </section>
  )
}
