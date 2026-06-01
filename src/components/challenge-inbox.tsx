'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { formatDateUY } from '@/lib/date-utils'
import {
  acceptChallengeAction,
  rejectChallengeAction,
  cancelChallengeAction,
} from '@/app/jugador/[slug]/escalera-actions'
import type { InboxChallenge } from '@/services/challenge-service'
import type { ActionResult } from '@/lib/action-types'

export function ChallengeInbox({ received, sent }: { received: InboxChallenge[]; sent: InboxChallenge[] }) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)

  if (received.length === 0 && sent.length === 0) return null

  function run(id: string, action: () => Promise<ActionResult>, okMsg: string) {
    setPendingId(id)
    action().then((r) => {
      if (r.success) {
        toast.success(okMsg)
        router.refresh()
      } else {
        toast.error(r.error || 'Ocurrió un error')
      }
      setPendingId(null)
    })
  }

  const rivalRow = (c: InboxChallenge) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={c.rival.image || undefined} />
        <AvatarFallback className="text-xs">{(c.rival.name[0] || '?').toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        {c.rival.playerSlug ? (
          <Link href={`/jugador/${c.rival.playerSlug}`} className="block truncate font-medium hover:underline">
            {c.rival.name}
          </Link>
        ) : (
          <p className="truncate font-medium">{c.rival.name}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {c.rival.rating != null ? `${c.rival.rating} de ranking · ` : ''}vence {formatDateUY(c.respondByAt)}
        </p>
        {c.preview && (
          <p className="text-xs">
            <span className="font-semibold text-green-600 tabular-nums dark:text-green-500">ganás +{c.preview.ifWin}</span>
            <span className="text-muted-foreground/50"> · </span>
            <span className="font-semibold text-red-600 tabular-nums dark:text-red-500">perdés {Math.abs(c.preview.ifLose)}</span>
          </p>
        )}
      </div>
    </div>
  )

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Retos</h2>
      <div className="space-y-2">
        {received.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            {rivalRow(c)}
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pendingId === c.id}
                onClick={() => run(c.id, () => rejectChallengeAction(c.id), 'Reto rechazado')}
                aria-label="Rechazar"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                disabled={pendingId === c.id}
                onClick={() => run(c.id, () => acceptChallengeAction(c.id), 'Reto aceptado')}
              >
                <Check className="h-4 w-4" />
                Aceptar
              </Button>
            </div>
          </div>
        ))}
        {sent.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3">
            {rivalRow(c)}
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">Esperando respuesta</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={pendingId === c.id}
                onClick={() => run(c.id, () => cancelChallengeAction(c.id), 'Reto cancelado')}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
