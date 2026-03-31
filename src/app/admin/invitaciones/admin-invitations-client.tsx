'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { UserPlus, Trash2 } from 'lucide-react'
import { createAdminInvitationAction, cancelAdminInvitationAction } from './actions'

interface Invitation {
  id: string
  email: string
  name: string | null
  expiresAt: Date
  createdAt: Date
  invitedBy: { name: string | null; email: string }
}

export function AdminInvitationsClient({
  invitations,
}: {
  invitations: Invitation[]
}) {
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createAdminInvitationAction({ email, name: name || undefined })
      if (result.success) {
        toast.success('Invitación enviada')
        setEmail('')
        setName('')
        setShowForm(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleCancel(id: string) {
    startTransition(async () => {
      const result = await cancelAdminInvitationAction(id)
      if (result.success) {
        toast.success('Invitación cancelada')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)}>
          <UserPlus className="h-4 w-4 mr-1" />
          Invitar admin
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border p-4 space-y-3 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="inv-email">Email</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@ejemplo.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-name">Nombre (opcional)</Label>
            <Input
              id="inv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Pérez"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Enviando...' : 'Enviar invitación'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {invitations.length === 0 ? (
        <p className="text-muted-foreground text-sm">No hay invitaciones pendientes.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Invitado por</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell>{inv.name || '-'}</TableCell>
                  <TableCell className="text-sm">
                    {inv.invitedBy.name || inv.invitedBy.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">Pendiente</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleCancel(inv.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
