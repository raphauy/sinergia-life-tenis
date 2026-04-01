'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { deleteTournamentAction } from '../actions'

interface Props {
  tournamentId: string
  playerCount: number
  matchCount: number
  groupCount: number
}

export function DeleteTournamentButton({ tournamentId, playerCount, matchCount, groupCount }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const hasData = playerCount > 0 || matchCount > 0 || groupCount > 0

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTournamentAction(tournamentId)
      if (result.success) {
        toast.success('Torneo eliminado')
        router.push('/admin/torneos')
      } else {
        toast.error(result.error)
      }
      setOpen(false)
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <AlertDialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar torneo</AlertDialogTitle>
            <AlertDialogDescription>
              {hasData
                ? 'Este torneo tiene datos asociados que se eliminarán permanentemente.'
                : 'El torneo será eliminado permanentemente. Esta accion no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {hasData && (
            <div className="px-6 pb-2 text-sm">
              <ul className="list-disc pl-5 space-y-1 mb-3">
                {playerCount > 0 && (
                  <li><strong>{playerCount}</strong> {playerCount === 1 ? 'jugador' : 'jugadores'}</li>
                )}
                {matchCount > 0 && (
                  <li><strong>{matchCount}</strong> {matchCount === 1 ? 'partido' : 'partidos'} (incluye resultados)</li>
                )}
                {groupCount > 0 && (
                  <li><strong>{groupCount}</strong> {groupCount === 1 ? 'grupo' : 'grupos'}</li>
                )}
              </ul>
              <p className="font-medium text-destructive">
                Esta accion no se puede deshacer.
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Eliminando...' : 'Eliminar torneo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
