'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ShieldPlus } from 'lucide-react'
import { PROTECTION_META } from '@/components/protection-meta'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateUY } from '@/lib/date-utils'
import { setProtectionAction, endProtectionAction, deleteProtectionAction } from './actions'
import type { AdminProtectionMemberRow } from '@/services/ladder-protection-service'
import type { ActionResult } from '@/lib/action-types'
import type { ProtectionReason } from '@prisma/client'

const REASONS: { value: ProtectionReason; label: string }[] = (
  ['INJURY', 'TRAVEL', 'OTHER'] as ProtectionReason[]
).map((value) => ({ value, label: PROTECTION_META[value].label }))

export function MemberProtectionManager({ members }: { members: AdminProtectionMemberRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dialogMember, setDialogMember] = useState<AdminProtectionMemberRow | null>(null)
  const [reason, setReason] = useState<ProtectionReason>('INJURY')
  const [note, setNote] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function openDialog(m: AdminProtectionMemberRow) {
    if (m.protection) {
      setReason(m.protection.reason)
      setNote(m.protection.note ?? '')
      setStartDate(m.protection.startDate)
      setEndDate(m.protection.endDate ?? undefined)
    } else {
      setReason('INJURY')
      setNote('')
      setStartDate(new Date())
      setEndDate(undefined)
    }
    setDialogMember(m)
  }

  const invalidRange = !!startDate && !!endDate && endDate < startDate

  function submit() {
    if (!dialogMember || !startDate) {
      toast.error('Elegí una fecha de inicio.')
      return
    }
    startTransition(async () => {
      const res = await setProtectionAction({
        protectionId: dialogMember.protection?.id,
        userId: dialogMember.userId,
        reason,
        note,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: endDate ? format(endDate, 'yyyy-MM-dd') : '',
      })
      if (res.success) {
        toast.success(res.message ?? 'Guardado.')
        setDialogMember(null)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function runAction(action: () => Promise<ActionResult>, okMsg: string) {
    startTransition(async () => {
      const res = await action()
      if (res.success) {
        toast.success(res.message ?? okMsg)
        setConfirmDeleteId(null)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Protegé a un jugador lesionado o de viaje: no se lo podrá retar y no recibirá la multa mensual si
        estuvo protegido más de la mitad del mes. Al protegerlo se cancelan sus retos y partidos pendientes.
      </p>
      <div className="divide-y overflow-hidden rounded-md border">
        {members.map((m) => {
          const p = m.protection
          const meta = p ? PROTECTION_META[p.reason] : null
          return (
            <div key={m.userId} className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 text-center text-sm font-bold tabular-nums text-muted-foreground">{m.position}</span>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={m.image || undefined} />
                <AvatarFallback className="text-xs">{(m.name[0] || '?').toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                {m.playerSlug ? (
                  <Link href={`/jugador/${m.playerSlug}`} className="block truncate text-sm font-medium hover:underline">
                    {m.name}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-medium">{m.name}</span>
                )}
                {p && meta && (
                  <p className={`mt-0.5 flex items-center gap-1 text-xs ${meta.icon}`}>
                    <meta.Icon className="h-3.5 w-3.5" />
                    {meta.label} · desde {formatDateUY(p.startDate)}
                    {p.endDate ? ` hasta ${formatDateUY(p.endDate)}` : ' (abierta)'}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {p ? (
                  confirmDeleteId === p.id ? (
                    <>
                      <Button variant="destructive" size="sm" disabled={pending} onClick={() => runAction(() => deleteProtectionAction(p.id), 'Protección eliminada')}>
                        Eliminar
                      </Button>
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirmDeleteId(null)}>
                        No
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openDialog(m)}>Editar</Button>
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => runAction(() => endProtectionAction(p.id), 'Protección terminada')}>
                        Terminar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(p.id)}>Eliminar</Button>
                    </>
                  )
                ) : (
                  <Button variant="outline" size="sm" onClick={() => openDialog(m)}>
                    <ShieldPlus className="h-4 w-4" /> Proteger
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={dialogMember != null} onOpenChange={(o) => !o && setDialogMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMember?.protection ? 'Editar protección' : 'Proteger jugador'}
              {dialogMember ? ` · ${dialogMember.name}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select value={reason} onValueChange={(v) => v && setReason(v as ProtectionReason)} items={REASONS}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <DatePicker value={startDate} onChange={(d) => setStartDate(d)} fromYear={2024} />
              </div>
              <div className="space-y-1.5">
                <Label>Hasta (opcional)</Label>
                <DatePicker value={endDate} onChange={(d) => setEndDate(d)} placeholder="Sin fin" fromYear={2024} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nota (opcional)</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: desgarro, viaje a Europa…" />
            </div>
            {invalidRange && (
              <p className="text-xs text-red-600 dark:text-red-500">La fecha de fin no puede ser anterior al inicio.</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={pending || !startDate || invalidRange}>
              {pending ? 'Guardando…' : dialogMember?.protection ? 'Guardar' : 'Proteger'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
