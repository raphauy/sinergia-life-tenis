'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { fullName } from '@/lib/format-name'
import { Mail, Save, X, Trash2, Search, MoreHorizontal, UserCheck, UserX, UserPlus } from 'lucide-react'
import {
  updatePlayerNameAction,
  updatePlayerEmailAction,
  updatePlayerWhatsappAction,
  invitePlayerAction,
  forceAcceptPlayerAction,
  deletePlayerAction,
  deleteManyPlayersAction,
  withdrawPlayerAction,
  reinstatePlayerAction,
} from './actions'

interface Player {
  id: string
  firstName: string
  lastName: string
  email: string | null
  whatsappNumber: string | null
  invitedAt: Date | null
  acceptedAt: Date | null
  withdrawnAt: Date | null
  category: { id: string; name: string }
  user: { firstName: string | null; lastName: string | null } | null
}

interface Category {
  id: string
  name: string
}

interface Props {
  tournamentSlug: string
  players: Player[]
  categories: Category[]
}

export function TournamentDetailClient({ tournamentSlug, players, categories }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'name' | 'email' | 'whatsapp' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null)
  const [withdrawTarget, setWithdrawTarget] = useState<Player | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Search & filter
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const debounceRef = useRef<NodeJS.Timeout>(undefined)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const filtered = useMemo(() => {
    return players.filter((p) => {
      if (categoryFilter && p.category.id !== categoryFilter) return false
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        const name = fullName(p.user?.firstName ?? p.firstName, p.user?.lastName ?? p.lastName).toLowerCase()
        const email = (p.email || '').toLowerCase()
        if (!name.includes(q) && !email.includes(q)) return false
      }
      return true
    })
  }, [players, categoryFilter, debouncedSearch])

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.includes(p.id))
  const someSelected = !allSelected && filtered.some((p) => selectedIds.includes(p.id))

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filtered.some((p) => p.id === id)))
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...filtered.map((p) => p.id)])])
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  function startEditing(player: Player, field: 'name' | 'email' | 'whatsapp') {
    setEditingId(player.id)
    setEditingField(field)
    setEditValue(
      field === 'name' ? fullName(player.user?.firstName ?? player.firstName, player.user?.lastName ?? player.lastName)
      : field === 'email' ? (player.email || '')
      : (player.whatsappNumber || '')
    )
  }

  function cancelEditing() {
    setEditingId(null)
    setEditingField(null)
    setEditValue('')
  }

  function saveField(playerId: string) {
    startTransition(async () => {
      const nameParts = editValue.trim().split(/\s+/)
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''
      const result =
        editingField === 'name' ? await updatePlayerNameAction(tournamentSlug, playerId, firstName, lastName)
        : editingField === 'email' ? await updatePlayerEmailAction(tournamentSlug, playerId, editValue)
        : await updatePlayerWhatsappAction(tournamentSlug, playerId, editValue)
      if (result.success) {
        toast.success(
          editingField === 'name' ? 'Nombre actualizado'
          : editingField === 'email' ? 'Email actualizado'
          : 'WhatsApp actualizado'
        )
        cancelEditing()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleInvite(playerId: string) {
    startTransition(async () => {
      const result = await invitePlayerAction(tournamentSlug, playerId)
      if (result.success) {
        toast.success('Invitación enviada')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleForceAccept(playerId: string) {
    startTransition(async () => {
      const result = await forceAcceptPlayerAction(tournamentSlug, playerId)
      if (result.success) {
        toast.success('Jugador marcado como aceptado')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deletePlayerAction(tournamentSlug, deleteTarget.id)
      if (result.success) {
        toast.success('Jugador eliminado')
        setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id))
      } else {
        toast.error(result.error)
      }
      setDeleteTarget(null)
    })
  }

  function handleWithdraw() {
    if (!withdrawTarget) return
    startTransition(async () => {
      const result = await withdrawPlayerAction(tournamentSlug, withdrawTarget.id)
      if (result.success) {
        toast.success('Jugador retirado del torneo')
      } else {
        toast.error(result.error)
      }
      setWithdrawTarget(null)
    })
  }

  function handleReinstate(playerId: string) {
    startTransition(async () => {
      const result = await reinstatePlayerAction(tournamentSlug, playerId)
      if (result.success) {
        toast.success('Jugador reingresado. Revisá el bracket y los partidos walkover creados al retirarlo.')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleBulkDelete() {
    startTransition(async () => {
      const result = await deleteManyPlayersAction(tournamentSlug, selectedIds)
      if (result.success) {
        toast.success(`${selectedIds.length} jugador(es) eliminado(s)`)
        setSelectedIds([])
      } else {
        toast.error(result.error)
      }
      setShowBulkDelete(false)
    })
  }

  function getStatus(player: Player) {
    if (player.withdrawnAt) return <Badge variant="destructive">Retirado</Badge>
    if (player.acceptedAt) return <Badge variant="default">Aceptado</Badge>
    if (player.invitedAt) return <Badge variant="secondary">Invitado</Badge>
    if (player.email) return <Badge variant="outline">Con email</Badge>
    return <Badge variant="outline" className="text-muted-foreground">Sin email</Badge>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">
          Jugadores ({players.length})
        </h2>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} seleccionado(s)
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDelete(true)}
              disabled={isPending}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Eliminar
            </Button>
          </div>
        )}
      </div>

      {/* Search & filter bar */}
      {players.length > 0 && (
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearch('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCategoryFilter('')}
              className={cn(
                'inline-flex h-5 items-center justify-center rounded-full border px-2 text-xs font-semibold transition-colors cursor-pointer',
                !categoryFilter
                  ? 'bg-primary/25 text-primary border-primary/40 ring-2 ring-foreground'
                  : 'bg-muted text-muted-foreground border-border hover:border-primary/30'
              )}
            >
              Todas
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(categoryFilter === c.id ? '' : c.id)}
                className="cursor-pointer"
              >
                <CategoryBadge
                  name={c.name}
                  className={cn(
                    'transition-all',
                    categoryFilter === c.id && 'ring-2 ring-foreground scale-110'
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {players.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay jugadores. Importá jugadores desde un CSV.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
                <TableHead className="w-14">Cat</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  data-state={selectedIds.includes(p.id) ? 'selected' : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(p.id)}
                      onCheckedChange={() => toggleSelect(p.id)}
                      aria-label={`Seleccionar ${fullName(p.firstName, p.lastName)}`}
                    />
                  </TableCell>
                  <TableCell>
                    <CategoryBadge name={p.category.name} />
                  </TableCell>
                  <TableCell>
                    {editingId === p.id && editingField === 'name' ? (
                      <div className="flex gap-1 items-center">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); saveField(p.id) }
                            if (e.key === 'Escape') cancelEditing()
                          }}
                          className="h-8 w-48"
                          placeholder="Nombre"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveField(p.id)} disabled={isPending}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEditing}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="font-medium cursor-pointer hover:underline"
                        onClick={() => startEditing(p, 'name')}
                      >
                        {fullName(p.user?.firstName ?? p.firstName, p.user?.lastName ?? p.lastName)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === p.id && editingField === 'email' ? (
                      <div className="flex gap-1 items-center">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); saveField(p.id) }
                            if (e.key === 'Escape') cancelEditing()
                          }}
                          className="h-8 w-48"
                          type="email"
                          placeholder="email@ejemplo.com"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => saveField(p.id)}
                          disabled={isPending}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={cancelEditing}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="text-sm cursor-pointer hover:underline"
                        onClick={() => startEditing(p, 'email')}
                      >
                        {p.email || '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === p.id && editingField === 'whatsapp' ? (
                      <div className="flex gap-1 items-center">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); saveField(p.id) }
                            if (e.key === 'Escape') cancelEditing()
                          }}
                          className="h-8 w-36"
                          type="tel"
                          placeholder="+598..."
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveField(p.id)} disabled={isPending}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEditing}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="text-sm cursor-pointer hover:underline"
                        onClick={() => startEditing(p, 'whatsapp')}
                      >
                        {p.whatsappNumber || '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{getStatus(p)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button size="icon" variant="ghost" className="h-7 w-7" disabled={isPending} />}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {p.email && !p.acceptedAt && (
                          <DropdownMenuItem onClick={() => handleInvite(p.id)}>
                            <Mail className="h-4 w-4 mr-2" />
                            {p.invitedAt ? 'Reenviar invitación' : 'Invitar'}
                          </DropdownMenuItem>
                        )}
                        {p.email && !p.acceptedAt && (
                          <DropdownMenuItem onClick={() => handleForceAccept(p.id)}>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Marcar aceptado
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {p.withdrawnAt ? (
                          <DropdownMenuItem onClick={() => handleReinstate(p.id)}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Reingresar al torneo
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => setWithdrawTarget(p)}
                            className="text-destructive focus:text-destructive"
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            Retirar del torneo
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(p)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Single delete dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar jugador</AlertDialogTitle>
            <AlertDialogDescription>
              El jugador &quot;{deleteTarget ? fullName(deleteTarget.firstName, deleteTarget.lastName) : ''}&quot; será eliminado del torneo permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Withdraw dialog */}
      <AlertDialog
        open={!!withdrawTarget}
        onOpenChange={(open) => !open && setWithdrawTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar del torneo</AlertDialogTitle>
            <AlertDialogDescription>
              {withdrawTarget && (
                <>
                  &quot;{fullName(withdrawTarget.user?.firstName ?? withdrawTarget.firstName, withdrawTarget.user?.lastName ?? withdrawTarget.lastName)}&quot; quedará marcado como retirado. Sus partidos de grupo pendientes o confirmados se cerrarán como walkover 6-0 a favor del rival, y el siguiente clasificado de su grupo lo reemplazará en el bracket. Los partidos ya jugados se mantienen.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWithdraw}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Retirar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete dialog */}
      <AlertDialog
        open={showBulkDelete}
        onOpenChange={(open) => !open && setShowBulkDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {selectedIds.length} jugador(es)</AlertDialogTitle>
            <AlertDialogDescription>
              Los jugadores seleccionados serán eliminados del torneo permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar {selectedIds.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
