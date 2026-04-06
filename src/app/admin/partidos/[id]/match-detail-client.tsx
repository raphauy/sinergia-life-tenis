'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { TIMEZONE } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { COURTS, TIME_SLOTS } from '@/lib/constants'
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
    walkover?: boolean
    set1Player1: number
    set1Player2: number
    tb1Player1?: number | null
    tb1Player2?: number | null
    set2Player1?: number | null
    set2Player2?: number | null
    tb2Player1?: number | null
    tb2Player2?: number | null
    superTbPlayer1?: number | null
    superTbPlayer2?: number | null
    winnerId?: string
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
  const [confirmCourt, setConfirmCourt] = useState('2')
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(
    scheduledAt ? new Date(scheduledAt) : undefined
  )
  const [rescheduleTime, setRescheduleTime] = useState(
    scheduledAt ? format(toZonedTime(new Date(scheduledAt), TIMEZONE), 'HH:mm') : ''
  )
  const [rescheduleCourt, setRescheduleCourt] = useState(
    courtNumber?.toString() ?? '2'
  )
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [cancelReason, setCancelReason] = useState('Cancelado por lluvia')

  const timeItems = TIME_SLOTS.map((t) => ({ value: t, label: t }))
  function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (!confirmDate) { toast.error('Seleccioná una fecha'); return }
    if (!form.get('time')) { toast.error('Seleccioná una hora'); return }
    if (!confirmCourt) { toast.error('Seleccioná una cancha'); return }
    startTransition(async () => {
      const res = await confirmMatchAction(matchId, {
        date: confirmDate ? format(confirmDate, 'yyyy-MM-dd') : null,
        time: form.get('time'),
        courtNumber: confirmCourt,
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
    if (!showCancelForm) {
      setShowCancelForm(true)
      return
    }
    if (!cancelReason.trim()) return
    startTransition(async () => {
      const res = await cancelMatchAction(matchId, cancelReason)
      if (res.success) {
        toast.success('Partido revertido a pendiente. Emails enviados.')
        setShowCancelForm(false)
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
          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
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
                    {TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cancha</Label>
              <div className="flex gap-1.5">
                {COURTS.map((c) => (
                  <Button
                    key={c.number}
                    type="button"
                    size="sm"
                    variant="outline"
                      className={confirmCourt === c.number.toString() ? 'border-foreground bg-foreground text-background' : ''}
                    onClick={() => setConfirmCourt(c.number.toString())}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Confirmando...' : 'Confirmar'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Reschedule + Cancel for confirmed */}
      {status === 'CONFIRMED' && !hasResult && (
        <div className="rounded-lg border p-4 space-y-4">
          <h2 className="font-semibold">Reprogramar partido</h2>
          <form onSubmit={handleReschedule} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
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
                    {TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cancha</Label>
              <div className="flex gap-1.5">
                {COURTS.map((c) => (
                  <Button
                    key={c.number}
                    type="button"
                    size="sm"
                    variant="outline"
                      className={rescheduleCourt === c.number.toString() ? 'border-foreground bg-foreground text-background' : ''}
                    onClick={() => setRescheduleCourt(c.number.toString())}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <Button type="button" variant="destructive" onClick={handleCancel} disabled={isPending}>
                Cancelar partido
              </Button>
            </div>
            {showCancelForm && (
              <div className="space-y-2 pt-2 border-t">
                <Label>Motivo de cancelación</Label>
                <Input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Motivo"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCancel() } }}
                />
                <div className="flex gap-2">
                  <Button type="button" variant="destructive" size="sm" onClick={handleCancel} disabled={isPending || !cancelReason.trim()}>
                    {isPending ? 'Cancelando...' : 'Confirmar cancelación'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowCancelForm(false)} disabled={isPending}>
                    No
                  </Button>
                </div>
              </div>
            )}
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
            player1Id={player1Id}
            player2Id={player2Id}
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
