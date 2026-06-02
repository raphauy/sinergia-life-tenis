'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { createChallengeAction, getChallengePreviewAction } from '@/app/jugador/[slug]/escalera-actions'

interface Props {
  rivalUserId: string
  rivalName: string
  size?: 'sm' | 'default'
  variant?: 'outline' | 'default'
  className?: string
  /** Preview ya calculado (p. ej. desde la tabla). Si se pasa, no se pide al servidor. */
  preview?: { ifWin: number; ifLose: number }
}

export function ChallengeButton({ rivalUserId, rivalName, size = 'sm', variant = 'outline', className, preview: initialPreview }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<{ ifWin: number; ifLose: number } | null>(initialPreview ?? null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function openDialog() {
    setOpen(true)
    if (!preview) {
      setLoadingPreview(true)
      const p = await getChallengePreviewAction(rivalUserId)
      setPreview(p)
      setLoadingPreview(false)
    }
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await createChallengeAction(rivalUserId)
      if (result.success) {
        toast.success(`Retaste a ${rivalName}`)
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error || 'No se pudo crear el reto')
      }
    })
  }

  return (
    <>
      <Button size={size} variant={variant} className={className} onClick={openDialog}>
        <Swords className="h-4 w-4" />
        Retar
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retar a {rivalName}</AlertDialogTitle>
            <AlertDialogDescription>
              Si {rivalName} acepta, se crea un partido de La Escalera. Coordinan el día y reservan la cancha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border p-3 text-sm">
            {loadingPreview ? (
              <p className="text-center text-muted-foreground">Calculando cambio de puntos…</p>
            ) : preview ? (
              <div className="flex justify-around text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Si ganás</p>
                  <p className="text-lg font-bold text-green-600 tabular-nums">+{preview.ifWin}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Si perdés</p>
                  <p className="text-lg font-bold text-red-600 tabular-nums">{preview.ifLose}</p>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">No se pudo calcular el cambio de puntos.</p>
            )}
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={isPending || loadingPreview}>
              {isPending ? 'Enviando…' : 'Retar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
