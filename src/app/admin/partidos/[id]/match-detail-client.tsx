'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { confirmMatchAction, cancelMatchAction, adminLoadResultAction } from '../actions'
import type { MatchFormat, MatchStatus } from '@/generated/prisma/client'

interface Props {
  matchId: string
  status: MatchStatus
  matchFormat: MatchFormat
  player1Id: string
  player2Id: string
  player1Name: string
  player2Name: string
  hasResult: boolean
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
  result,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await confirmMatchAction(matchId, {
        date: form.get('date'),
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
                <Label htmlFor="date">Fecha</Label>
                <Input id="date" name="date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Hora</Label>
                <Input id="time" name="time" type="time" required />
              </div>
              <div className="space-y-2">
                <Label>Cancha</Label>
                <Select name="courtNumber" required>
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

      {/* Cancel button for confirmed */}
      {status === 'CONFIRMED' && !hasResult && (
        <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
          Cancelar partido
        </Button>
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
