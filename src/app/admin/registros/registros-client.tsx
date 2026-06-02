'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Check, X, Mail, Phone, Clock } from 'lucide-react'
import { approvePlayerRegistrationAction, rejectPlayerRegistrationAction } from './actions'
import { fullName, initials } from '@/lib/format-name'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Registration {
  id: string
  firstName: string
  lastName: string
  email: string
  whatsappNumber: string
  createdAt: Date
}

type Confirm = { id: string; action: 'approve' | 'reject'; name: string }

export function RegistrosClient({ registrations }: { registrations: Registration[] }) {
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [isPending, startTransition] = useTransition()

  function run() {
    if (!confirm) return
    const { id, action } = confirm
    startTransition(async () => {
      const result =
        action === 'approve'
          ? await approvePlayerRegistrationAction(id)
          : await rejectPlayerRegistrationAction(id)
      if (result.success) {
        toast.success(result.message ?? (action === 'approve' ? 'Aprobado' : 'Rechazado'))
      } else {
        toast.error(result.error)
      }
      setConfirm(null)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Registros pendientes</h1>
        <p className="text-muted-foreground text-sm">
          Solicitudes de jugadores nuevos para sumarse a La Escalera.
        </p>
      </div>

      {registrations.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay registros pendientes.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pendientes ({registrations.length})</CardTitle>
            <CardDescription>
              Al aprobar, el jugador entra a La Escalera al pie (rating del último − 20 puntos) y recibe
              un email de bienvenida.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {registrations.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar size="sm">
                    <AvatarFallback>{initials(r.firstName, r.lastName) || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{fullName(r.firstName, r.lastName)}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {r.email}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {r.whatsappNumber}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => setConfirm({ id: r.id, action: 'approve', name: fullName(r.firstName, r.lastName) })}
                  >
                    <Check className="h-4 w-4" />
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={isPending}
                    onClick={() => setConfirm({ id: r.id, action: 'reject', name: fullName(r.firstName, r.lastName) })}
                  >
                    <X className="h-4 w-4" />
                    Rechazar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === 'approve' ? 'Aprobar registro' : 'Rechazar registro'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === 'approve' ? (
                <>
                  Se creará la cuenta de <strong>{confirm?.name}</strong> y entrará a La Escalera al pie
                  (rating del último − 20). Se le enviará un email de bienvenida.
                </>
              ) : (
                <>
                  Se rechazará la solicitud de <strong>{confirm?.name}</strong>. No se creará ninguna
                  cuenta.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={run}
              className={
                confirm?.action === 'reject'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
            >
              {isPending ? '…' : confirm?.action === 'approve' ? 'Aprobar' : 'Rechazar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
