'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Plus, Trash2, Swords, AlertTriangle, Users, GripVertical } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  createGroupAction,
  deleteGroupAction,
  checkAffectedMatchesAction,
  setGroupPlayersAction,
  generateRoundRobinMatchesAction,
  deletePendingMatchesAction,
} from './actions'

interface GroupPlayer {
  id: string
  name: string
  userId: string | null
  email: string | null
}

interface Group {
  id: string
  number: number
  categoryId: string
  players: GroupPlayer[]
  matchCount: number
  pendingMatchCount: number
}

interface Category {
  id: string
  name: string
}

interface SimplePlayer {
  id: string
  name: string
  userId: string | null
  categoryId: string
  groupId: string | null
}

interface Props {
  tournamentId: string
  categories: Category[]
  groups: Group[]
  allPlayers: SimplePlayer[]
}

// Draggable player item
function DraggablePlayer({ player }: { player: { id: string; name: string; userId: string | null } }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.id,
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.3 : 1 }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing hover:bg-muted/50"
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className={player.userId ? '' : 'text-muted-foreground'}>{player.name}</span>
      {!player.userId && (
        <span title="Sin cuenta vinculada">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
        </span>
      )}
    </div>
  )
}

// Droppable column
function DroppableColumn({
  id,
  title,
  players,
  emptyText,
}: {
  id: string
  title: string
  players: { id: string; name: string; userId: string | null }[]
  emptyText: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-medium mb-2">
        {title} ({players.length})
      </h3>
      <div
        ref={setNodeRef}
        className={`space-y-1 min-h-[200px] max-h-[400px] overflow-y-auto rounded-md border border-dashed p-2 transition-colors ${isOver ? 'border-primary bg-primary/5' : ''}`}
      >
        {players.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">{emptyText}</p>
        ) : (
          players.map((p) => <DraggablePlayer key={p.id} player={p} />)
        )}
      </div>
    </div>
  )
}

export function GroupsSection({ tournamentId, categories, groups, allPlayers }: Props) {
  const [isPending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null)
  const [generateTarget, setGenerateTarget] = useState<Group | null>(null)
  const [deleteMatchesTarget, setDeleteMatchesTarget] = useState<Group | null>(null)

  // Dialog state for player assignment
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [groupPlayerIds, setGroupPlayerIds] = useState<string[]>([])
  const [affectedCount, setAffectedCount] = useState<number>(0)
  const [showAffectedWarning, setShowAffectedWarning] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function openPlayerDialog(group: Group) {
    setEditingGroup(group)
    setGroupPlayerIds(group.players.map((p) => p.id))
  }

  function closePlayerDialog() {
    setEditingGroup(null)
    setGroupPlayerIds([])
  }

  function getAvailablePlayers() {
    if (!editingGroup) return []
    // Players in the same category that are NOT in any other group and NOT in the current selection
    return allPlayers.filter(
      (p) =>
        p.categoryId === editingGroup.categoryId &&
        !groupPlayerIds.includes(p.id) &&
        (!p.groupId || p.groupId === editingGroup.id)
    )
  }

  function getGroupPlayersForDialog() {
    if (!editingGroup) return []
    return groupPlayerIds.map((id) => {
      const fromGroup = editingGroup.players.find((p) => p.id === id)
      if (fromGroup) return fromGroup
      const fromAll = allPlayers.find((p) => p.id === id)!
      return { id: fromAll.id, name: fromAll.name, userId: fromAll.userId, email: null }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over) return

    const playerId = active.id as string
    const isInGroup = groupPlayerIds.includes(playerId)
    const overId = over.id as string

    // Dropped on the group column (or a player inside it)
    const droppedOnGroup = overId === 'group-column' || groupPlayerIds.includes(overId)
    // Dropped on the available column (or a player inside it)
    const droppedOnAvailable = overId === 'available-column' || (!groupPlayerIds.includes(overId) && overId !== playerId)

    if (!isInGroup && droppedOnGroup) {
      setGroupPlayerIds((prev) => [...prev, playerId])
    } else if (isInGroup && droppedOnAvailable) {
      setGroupPlayerIds((prev) => prev.filter((id) => id !== playerId))
    }
  }

  function handleSaveGroupPlayers() {
    if (!editingGroup) return
    startTransition(async () => {
      // Check for affected pending matches
      const check = await checkAffectedMatchesAction(editingGroup.id, groupPlayerIds)
      if (check.success && check.data && check.data.count > 0) {
        setAffectedCount(check.data.count)
        setShowAffectedWarning(true)
        return
      }
      // No affected matches, save directly
      doSaveGroupPlayers(false)
    })
  }

  function doSaveGroupPlayers(cancelPending: boolean) {
    if (!editingGroup) return
    startTransition(async () => {
      const result = await setGroupPlayersAction(tournamentId, editingGroup.id, groupPlayerIds, cancelPending)
      if (result.success) {
        toast.success(
          cancelPending
            ? 'Jugadores actualizados y partidos pendientes cancelados'
            : 'Jugadores actualizados'
        )
        closePlayerDialog()
        setShowAffectedWarning(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleCreateGroup(categoryId: string) {
    startTransition(async () => {
      const result = await createGroupAction(tournamentId, categoryId)
      if (result.success) {
        toast.success('Grupo creado')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDeleteGroup() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteGroupAction(tournamentId, deleteTarget.id)
      if (result.success) {
        toast.success('Grupo eliminado')
      } else {
        toast.error(result.error)
      }
      setDeleteTarget(null)
    })
  }

  function handleDeletePendingMatches() {
    if (!deleteMatchesTarget) return
    startTransition(async () => {
      const result = await deletePendingMatchesAction(tournamentId, deleteMatchesTarget.id)
      if (result.success) {
        const count = result.data?.count ?? 0
        toast.success(`${count} partidos pendientes eliminados`)
      } else {
        toast.error(result.error)
      }
      setDeleteMatchesTarget(null)
    })
  }

  function handleGenerateMatches() {
    if (!generateTarget) return
    startTransition(async () => {
      const result = await generateRoundRobinMatchesAction(tournamentId, generateTarget.id)
      if (result.success) {
        const count = result.data?.count ?? 0
        if (count === 0) {
          toast.info('No se crearon partidos (ya existen todos los cruces)')
        } else {
          toast.success(`${count} partidos creados`)
        }
      } else {
        toast.error(result.error)
      }
      setGenerateTarget(null)
    })
  }

  function getGroupsForCategory(categoryId: string) {
    return groups.filter((g) => g.categoryId === categoryId)
  }

  function getEligibleCount(group: Group) {
    return group.players.filter((p) => p.userId).length
  }

  function getPossibleMatches(eligibleCount: number) {
    return (eligibleCount * (eligibleCount - 1)) / 2
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-4">Grupos</h2>

      {categories.map((cat) => {
        const catGroups = getGroupsForCategory(cat.id)

        return (
          <div key={cat.id} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <CategoryBadge name={cat.name} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCreateGroup(cat.id)}
                disabled={isPending}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Crear grupo
              </Button>
            </div>

            {catGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground ml-1">Sin grupos en esta categoría.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {catGroups.map((group) => {
                  const eligible = getEligibleCount(group)
                  const possibleMatches = getPossibleMatches(eligible)
                  const unlinked = group.players.filter((p) => !p.userId)

                  return (
                    <Card key={group.id} className="flex flex-col">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Grupo {group.number}</CardTitle>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {group.players.length} {group.players.length === 1 ? 'jugador' : 'jugadores'}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {group.matchCount} {group.matchCount === 1 ? 'partido' : 'partidos'}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col flex-1 space-y-3">
                        {group.players.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Sin jugadores asignados.
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {group.players.map((p) => (
                              <li key={p.id} className="text-sm flex items-center gap-1.5">
                                <span className={p.userId ? '' : 'text-muted-foreground'}>
                                  {p.name}
                                </span>
                                {!p.userId && (
                                  <span title="Sin cuenta vinculada">
                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}

                        {unlinked.length > 0 && (
                          <p className="text-xs text-amber-600">
                            {unlinked.length} sin cuenta (no participan en partidos)
                          </p>
                        )}

                        <div className="flex gap-2 pt-1 mt-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPlayerDialog(group)}
                            disabled={isPending}
                          >
                            <Users className="h-3.5 w-3.5 mr-1" />
                            Jugadores
                          </Button>
                          {group.pendingMatchCount > 0 ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleteMatchesTarget(group)}
                              disabled={isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Eliminar pendientes ({group.pendingMatchCount})
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setGenerateTarget(group)}
                              disabled={isPending || eligible < 2}
                              title={eligible < 2 ? 'Se necesitan al menos 2 jugadores vinculados' : `Generar ${possibleMatches} partidos`}
                            >
                              <Swords className="h-3.5 w-3.5 mr-1" />
                              Generar partidos
                            </Button>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeleteTarget(group)}
                                    disabled={isPending}
                                  />
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </TooltipTrigger>
                              <TooltipContent>Eliminar grupo</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Player assignment dialog */}
      <Dialog open={!!editingGroup} onOpenChange={(open) => !open && closePlayerDialog()}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Jugadores — Grupo {editingGroup?.number}</DialogTitle>
            <DialogDescription>
              Arrastrá jugadores entre las columnas para asignarlos al grupo.
            </DialogDescription>
          </DialogHeader>

          {editingGroup && (
            <DndContext
              sensors={sensors}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4">
                <DroppableColumn
                  id="group-column"
                  title="En el grupo"
                  players={getGroupPlayersForDialog()}
                  emptyText="Arrastrá jugadores aquí"
                />
                <DroppableColumn
                  id="available-column"
                  title="Disponibles"
                  players={getAvailablePlayers()}
                  emptyText="No hay jugadores disponibles"
                />
              </div>
            </DndContext>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closePlayerDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSaveGroupPlayers} disabled={isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete pending matches confirmation */}
      <AlertDialog
        open={!!deleteMatchesTarget}
        onOpenChange={(open) => !open && setDeleteMatchesTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar partidos pendientes</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán {deleteMatchesTarget?.pendingMatchCount} partidos pendientes del Grupo {deleteMatchesTarget?.number}. Los partidos confirmados o jugados no se verán afectados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePendingMatches}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate matches confirmation */}
      <AlertDialog
        open={!!generateTarget}
        onOpenChange={(open) => !open && setGenerateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generar partidos round-robin</AlertDialogTitle>
            <AlertDialogDescription>
              {generateTarget && (() => {
                const eligible = getEligibleCount(generateTarget)
                const possible = getPossibleMatches(eligible)
                return `Se crearán hasta ${possible} partidos para el Grupo ${generateTarget.number} (${eligible} jugadores elegibles). Los partidos existentes no se duplicarán.`
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerateMatches}>
              Generar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete group confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Grupo {deleteTarget?.number}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.matchCount
                ? `Este grupo tiene ${deleteTarget.matchCount} partidos. Los partidos no se eliminarán pero perderán su asociación al grupo.`
                : 'Los jugadores asignados quedarán sin grupo.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Affected matches warning */}
      <AlertDialog
        open={showAffectedWarning}
        onOpenChange={(open) => !open && setShowAffectedWarning(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Partidos pendientes afectados</AlertDialogTitle>
            <AlertDialogDescription>
              Hay {affectedCount} partidos pendientes con jugadores que estás quitando del grupo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => doSaveGroupPlayers(false)}
              variant="outline"
            >
              Guardar sin cancelar
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => doSaveGroupPlayers(true)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Guardar y cancelar pendientes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
