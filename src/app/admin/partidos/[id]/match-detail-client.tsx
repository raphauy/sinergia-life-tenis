'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { TIMEZONE } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { COURTS } from '@/lib/constants'
import { MatchResultForm } from '@/components/match-result-form'
import { confirmMatchAction, rescheduleMatchAction, cancelMatchAction, adminLoadResultAction } from '../actions'
import type { MatchFormat, MatchStatus } from '@prisma/client'

interface Props {
  matchId: string
  status: MatchStatus
  matchFormat: MatchFormat
  player1Id: string
  player2Id: string
  player1Name: string
  player2Name: string
  hasResult: boolean
  scheduledAt?: string | null
  courtNumber?: number | null
  result?: {
    set1Player1: number
    set1Player2: number
    set2Player1?: number | null
    set2Player2?: number | null
    superTbPlayer1?: number | null
    superTbPlayer2?: number | null
  }
}

export function MatchDetailClient({
  matchId,
  status,
  matchFormat,
  player1Id,
  player2Id,
  player1Name,
  player2Name,
  hasResult,
  scheduledAt,
  courtNumber,
  result,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmDate, setConfirmDate] = useState<Date | undefined>()
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(
    scheduledAt ? new Date(scheduledAt) : undefined
  )
  const [rescheduleTime, setRescheduleTime] = useState(
    scheduledAt ? format(toZonedTime(new Date(scheduledAt), TIMEZONE), 'HH:mm') : ''
  )
  const [rescheduleCourt, setRescheduleCourt] = useState(
    courtNumber?.toString() ?? ''
  )

  const timeSlots = Array.from({ length: 28 }, (_, i) => {
    const h = Math.floor(i / 2) + 7
    const m = i % 2 === 0 ? '00' : '30'
    return `${h.toString().padStart(2, '0')}:${m}`
  })
  const timeItems = timeSlots.map((t) => ({ value: t, label: t }))
  const courtItems = COURTS.map((c) => ({ value: c.number.toString(), label: c.name }))

  function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (!confirmDate) { toast.error('Seleccioná una fecha'); return }
    if (!form.get('time')) { toast.error('Seleccioná una hora'); return }
    if (!form.get('courtNumber')) { toast.error('Seleccioná una cancha'); return }
    startTransition(async () => {
      const res = await confirmMatchAction(matchId, {
        date: confirmDate ? format(confirmDate, 'yyyy-MM-dd') : null,
        time: form.get('time'),
        courtNumber: form.get('courtNumber'),
      })
      if (res.success) {
        toast.success('Partido confirmado. Emails enviados.')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleCancel() {
    startTransition(async () => {
      const res = await cancelMatchAction(matchId)
      if (res.success) {
        toast.success('Partido cancelado')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleReschedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!rescheduleDate) { toast.error('Seleccioná una fecha'); return }
    if (!rescheduleTime) { toast.error('Seleccioná una hora'); return }
    if (!rescheduleCourt) { toast.error('Seleccioná una cancha'); return }
    startTransition(async () => {
      const res = await rescheduleMatchAction(matchId, {
        date: format(rescheduleDate, 'yyyy-MM-dd'),
        time: rescheduleTime,
        courtNumber: rescheduleCourt,
      })
      if (res.success) {
        toast.success('Partido reprogramado')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  async function handleResult(data: Record<string, unknown>) {
    return adminLoadResultAction(matchId, data)
  }

  if (status === 'CANCELLED') {
    return <p className="text-muted-foreground">Este partido fue cancelado.</p>
  }

  return (
    <div className="space-y-6">
      {/* Confirm form */}
      {status === 'PENDING' && (
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Confirmar partido</h2>
          <form onSubmit={handleConfirm} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <DatePicker value={confirmDate} onChange={setConfirmDate} />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Select name="time" items={timeItems}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cancha</Label>
                <Select name="courtNumber" items={courtItems}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cancha" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURTS.map((c) => (
                      <SelectItem key={c.number} value={c.number.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Confirmando...' : 'Confirmar'}
              </Button>
              <Button type="button" variant="destructive" onClick={handleCancel} disabled={isPending}>
                Cancelar partido
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Reschedule + Cancel for confirmed */}
      {status === 'CONFIRMED' && !hasResult && (
        <div className="rounded-lg border p-4 space-y-4">
          <h2 className="font-semibold">Reprogramar partido</h2>
          <form onSubmit={handleReschedule} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <DatePicker value={rescheduleDate} onChange={setRescheduleDate} />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Select value={rescheduleTime} onValueChange={(v) => setRescheduleTime(v ?? '')} items={timeItems}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cancha</Label>
                <Select value={rescheduleCourt} onValueChange={(v) => setRescheduleCourt(v ?? '')} items={courtItems}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cancha" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURTS.map((c) => (
                      <SelectItem key={c.number} value={c.number.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <Button type="button" variant="destructive" onClick={handleCancel} disabled={isPending}>
                Cancelar partido
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Result form */}
      {(status === 'CONFIRMED' || status === 'PLAYED') && (
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-3">
            {hasResult ? 'Editar resultado' : 'Cargar resultado'}
          </h2>
          <MatchResultForm
            matchFormat={matchFormat}
            player1Name={player1Name}
            player2Name={player2Name}
            defaultValues={result}
            onSubmit={async (data) => {
              const res = await handleResult(data)
              if (res.success) {
                toast.success(hasResult ? 'Resultado actualizado' : 'Resultado cargado')
                router.refresh()
              }
              return res
            }}
            isPending={isPending}
          />
        </div>
      )}
    </div>
  )
}
