'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarCheck, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { closeMonthAction, runDailyTasksAction } from './actions'

interface MonthOption {
  value: string // "YYYY-M"
  label: string
}

interface Props {
  lastClose: { label: string; closedAtLabel: string } | null
  monthOptions: MonthOption[]
  defaultMonth: string
}

export function LadderPeriodControls({ lastClose, monthOptions, defaultMonth }: Props) {
  const router = useRouter()
  const [period, setPeriod] = useState(defaultMonth)
  const [confirm, setConfirm] = useState(false)
  const [closing, startClose] = useTransition()
  const [running, startRun] = useTransition()

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

        <div className="border-t pt-3">
          <Button variant="outline" size="sm" disabled={running} onClick={doRun}>
            <RefreshCw className="h-4 w-4" />
            {running ? 'Corriendo…' : 'Correr tareas diarias'}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            Expira retos vencidos, avisa/auto-cancela partidos pendientes sin reserva y manda el aviso pre-cierre.
          </p>
        </div>
      </div>
    </section>
  )
}
