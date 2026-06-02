'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { cancelLadderMatchAction } from '@/app/jugador/[slug]/escalera-actions'

export function CancelLadderMatchButton({ matchId }: { matchId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelLadderMatchAction(matchId)
      if (result.success) {
        toast.success('Partido cancelado')
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error || 'No se pudo cancelar el partido')
      }
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Cancelar partido
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar el partido</AlertDialogTitle>
            <AlertDialogDescription>
              Se cancela el partido de La Escalera y se libera la reserva si la había. No afecta los puntos. Pueden volver a retarse cuando quieran.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Volver
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
              {isPending ? 'Cancelando…' : 'Cancelar partido'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
