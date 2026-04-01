'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { UserPlus, Send, X, Copy, RefreshCw, Clock, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  createAdminInvitationAction,
  cancelAdminInvitationAction,
  resendAdminInvitationAction,
  removeAdminAction,
} from './actions'
import { fullName, initials } from '@/lib/format-name'
import { formatDistanceToNow, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'

interface Invitation {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  token: string
  expiresAt: Date
  createdAt: Date
  invitedBy: { firstName: string | null; lastName: string | null; email: string }
}

interface AdminUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  image: string | null
  role: string
  createdAt: Date
}

function getExpirationText(expiresAt: Date): string {
  const days = differenceInDays(new Date(expiresAt), new Date())
  if (days <= 0) return 'Expira hoy'
  if (days === 1) return 'Expira en 1 día'
  return `Expira en ${days} días`
}

function getInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/invite/admin/${token}`
}

export function AdminUsersClient({
  invitations,
  adminUsers,
  currentUserId,
}: {
  invitations: Invitation[]
  adminUsers: AdminUser[]
  currentUserId: string
}) {
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { toast.error('Email requerido'); return }
    startTransition(async () => {
      const result = await createAdminInvitationAction({ email, firstName: firstName || undefined, lastName: lastName || undefined })
      if (result.success) {
        toast.success('Invitación enviada')
        setEmail('')
        setFirstName('')
        setLastName('')
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

  function handleResend(id: string) {
    startTransition(async () => {
      const result = await resendAdminInvitationAction(id)
      if (result.success) {
        toast.success('Email reenviado')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleRemoveAdmin() {
    if (!removeTarget) return
    startTransition(async () => {
      const result = await removeAdminAction(removeTarget.id)
      if (result.success) {
        toast.success('Administrador eliminado')
      } else {
        toast.error(result.error)
      }
      setRemoveTarget(null)
    })
  }

  async function handleCopyLink(token: string) {
    try {
      await navigator.clipboard.writeText(getInviteUrl(token))
      toast.success('Link copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar el link')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona los usuarios administradores y sus invitaciones
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <UserPlus className="h-4 w-4" />
          Invitar admin
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nueva invitación</CardTitle>
            <CardDescription>
              Envía una invitación por email para un nuevo administrador
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="inv-email">Email</Label>
                <Input
                  id="inv-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-firstName">Nombre (opcional)</Label>
                <Input
                  id="inv-firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Juan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-lastName">Apellido (opcional)</Label>
                <Input
                  id="inv-lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Pérez"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                  <Send className="h-4 w-4" />
                  {isPending ? 'Enviando...' : 'Enviar invitación'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Invitaciones pendientes
            </CardTitle>
            <CardDescription>
              Usuarios que han sido invitados pero aún no han aceptado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar size="sm">
                    <AvatarFallback>
                      {initials(inv.firstName, inv.lastName) || inv.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{inv.email}</span>
                      <Badge variant="secondary">Admin</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getExpirationText(inv.expiresAt)}
                      {' · '}
                      Invitado por {fullName(inv.invitedBy.firstName, inv.invitedBy.lastName) || inv.invitedBy.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyLink(inv.token)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar link
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResend(inv.id)}
                    disabled={isPending}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reenviar Email
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleCancel(inv.id)}
                    disabled={isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Admin users table */}
      <Card>
        <CardHeader>
          <CardTitle>Administradores ({adminUsers.length})</CardTitle>
          <CardDescription>
            Gestiona los roles y permisos de los administradores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Miembro desde</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        {user.image && <AvatarImage src={user.image} alt={fullName(user.firstName, user.lastName) || user.email} />}
                        <AvatarFallback>
                          {initials(user.firstName, user.lastName) || user.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">
                          {fullName(user.firstName, user.lastName) || user.email.split('@')[0]}
                        </div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'SUPERADMIN' ? 'default' : 'secondary'}>
                      {user.role === 'SUPERADMIN' ? 'Super Admin' : 'Admin'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(user.createdAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button size="icon" variant="ghost" className="h-8 w-8" />}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          onClick={() => {
                            navigator.clipboard.writeText(user.email)
                            toast.success('Email copiado')
                          }}
                        >
                          Copiar email
                        </DropdownMenuItem>
                        {user.role !== 'SUPERADMIN' && user.id !== currentUserId && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setRemoveTarget(user)}
                            >
                              Eliminar administrador
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Remove admin confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar administrador</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará el rol de administrador a{' '}
              <strong>{(removeTarget ? fullName(removeTarget.firstName, removeTarget.lastName) : '') || removeTarget?.email}</strong>. Esta acción se puede revertir enviando una nueva invitación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveAdmin}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
