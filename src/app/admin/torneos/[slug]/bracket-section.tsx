'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
import { Trophy, Trash2, RefreshCw, Loader2 } from 'lucide-react'
import { fullName } from '@/lib/format-name'
import { MATCH_STATUS_LABELS, MATCH_STATUS_VARIANTS } from '@/lib/match-status'
import {
  previewBracketAction,
  generateBracketAction,
  regenerateBracketAction,
  deleteBracketAction,
} from './actions'

interface BracketPlayer {
  id: string
  firstName: string | null
  lastName: string | null
}

interface BracketMatchView {
  id: string
  stage: string
  bracketPosition: number | null
  status: string
  player1: BracketPlayer | null
  player2: BracketPlayer | null
  player1SourceGroup: { number: number } | null
  player2SourceGroup: { number: number } | null
  player1SourcePosition: number | null
  player2SourcePosition: number | null
  scheduledAt: Date | null
  courtNumber: number | null
  hasResult: boolean
}

interface Category {
  id: string
  name: string
  bracket: BracketMatchView[]
}

interface Props {
  tournamentSlug: string
  categories: Category[]
}

function playerLabel(
  player: BracketPlayer | null,
  sourceGroup: { number: number } | null,
  sourcePosition: number | null,
  stage: string,
  bracketPosition: number | null,
  side: 'player1' | 'player2',
): string {
  if (player) return fullName(player.firstName, player.lastName) || 'Jugador'
  if (sourceGroup && sourcePosition) {
    return `${sourcePosition}° Grupo ${sourceGroup.number}`
  }
  if (stage === 'SEMIFINAL' && bracketPosition != null) {
    const qfNum = (bracketPosition - 1) * 2 + (side === 'player1' ? 1 : 2)
    return `Ganador QF${qfNum}`
  }
  if (stage === 'FINAL') {
    return side === 'player1' ? 'Ganador Semifinal 1' : 'Ganador Semifinal 2'
  }
  return 'Por definir'
}

function StageRoundHeader({ stage, matches }: { stage: string; matches: BracketMatchView[] }) {
  const label = stage === 'QUARTERFINAL' ? 'Cuartos de final' : stage === 'SEMIFINAL' ? 'Semifinal' : 'Final'
  return (
    <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2">
      {label} ({matches.length})
    </h3>
  )
}

function BracketMatchRow({
  match,
  tournamentSlug,
}: {
  match: BracketMatchView
  tournamentSlug: string
}) {
  const p1 = playerLabel(
    match.player1,
    match.player1SourceGroup,
    match.player1SourcePosition,
    match.stage,
    match.bracketPosition,
    'player1',
  )
  const p2 = playerLabel(
    match.player2,
    match.player2SourceGroup,
    match.player2SourcePosition,
    match.stage,
    match.bracketPosition,
    'player2',
  )
  const posLabel = match.bracketPosition != null
    ? match.stage === 'QUARTERFINAL' ? `QF${match.bracketPosition}` : match.stage === 'SEMIFINAL' ? `SF${match.bracketPosition}` : 'F'
    : ''

  return (
    <Link
      href={`/admin/partidos/${match.id}`}
      className="flex items-center justify-between rounded border p-2 hover:bg-muted/50"
    >
      <div className="flex items-center gap-2 text-sm">
        {posLabel && <span className="text-xs text-muted-foreground w-8 shrink-0">{posLabel}</span>}
        <span className={match.player1 ? '' : 'text-muted-foreground italic'}>{p1}</span>
        <span className="text-muted-foreground text-xs">vs</span>
        <span className={match.player2 ? '' : 'text-muted-foreground italic'}>{p2}</span>
      </div>
      <Badge variant={MATCH_STATUS_VARIANTS[match.status as keyof typeof MATCH_STATUS_VARIANTS] || 'outline'} className="text-xs">
        {MATCH_STATUS_LABELS[match.status as keyof typeof MATCH_STATUS_LABELS] || match.status}
      </Badge>
    </Link>
  )
}

export function BracketSection({ tournamentSlug, categories }: Props) {
  const [expanded, setExpanded] = useState(true)
  const router = useRouter()

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 mb-4"
      >
        <h2 className="text-xl font-bold">Fase eliminatoria</h2>
        <span className="text-xs text-muted-foreground">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="space-y-6">
          {categories.map((cat) => (
            <CategoryBracketCard
              key={cat.id}
              tournamentSlug={tournamentSlug}
              category={cat}
              onChange={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryBracketCard({
  tournamentSlug,
  category,
  onChange,
}: {
  tournamentSlug: string
  category: Category
  onChange: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState<'generate' | 'regenerate' | 'regenerate-force' | 'delete' | null>(null)
  const [previewInfo, setPreviewInfo] = useState<{ pendingGroupNumbers: number[] } | null>(null)

  const hasBracket = category.bracket.length > 0
  const qfs = category.bracket.filter((m) => m.stage === 'QUARTERFINAL').sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0))
  const sfs = category.bracket.filter((m) => m.stage === 'SEMIFINAL').sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0))
  const final = category.bracket.find((m) => m.stage === 'FINAL')
  const advanced = category.bracket.filter((m) => m.status === 'CONFIRMED' || m.status === 'PLAYED').length

  async function openGenerate() {
    const res = await previewBracketAction(category.id)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    setPreviewInfo({ pendingGroupNumbers: res.data!.pendingGroupNumbers })
    setConfirmOpen('generate')
  }

  function runGenerate() {
    startTransition(async () => {
      const res = await generateBracketAction(tournamentSlug, category.id)
      if (res.success) {
        toast.success('Bracket generado')
        onChange()
      } else {
        toast.error(res.error)
      }
      setConfirmOpen(null)
    })
  }

  async function openRegenerate() {
    const res = await previewBracketAction(category.id)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    setPreviewInfo({ pendingGroupNumbers: res.data!.pendingGroupNumbers })
    setConfirmOpen(advanced > 0 ? 'regenerate-force' : 'regenerate')
  }

  function runRegenerate(force: boolean) {
    startTransition(async () => {
      const res = await regenerateBracketAction(tournamentSlug, category.id, force)
      if (res.success) {
        toast.success('Bracket regenerado')
        onChange()
      } else {
        toast.error(res.error)
      }
      setConfirmOpen(null)
    })
  }

  function runDelete() {
    startTransition(async () => {
      const res = await deleteBracketAction(tournamentSlug, category.id)
      if (res.success) {
        toast.success(`Bracket eliminado (${res.data!.count} partidos)`)
        onChange()
      } else {
        toast.error(res.error)
      }
      setConfirmOpen(null)
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CategoryBadge name={category.name} />
            <span>Fase eliminatoria — Categoría {category.name}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {!hasBracket && (
              <Button size="sm" onClick={openGenerate} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4 mr-1" />}
                Generar cuartos
              </Button>
            )}
            {hasBracket && (
              <>
                <Button size="sm" variant="outline" onClick={openRegenerate} disabled={isPending}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setConfirmOpen('delete')} disabled={isPending}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasBracket ? (
          <p className="text-sm text-muted-foreground">
            Todavía no generaste la fase eliminatoria. Al generarla se crean los partidos de cuartos, semis y final.
          </p>
        ) : (
          <div className="space-y-4">
            {qfs.length > 0 && (
              <div>
                <StageRoundHeader stage="QUARTERFINAL" matches={qfs} />
                <div className="space-y-1">
                  {qfs.map((m) => (
                    <BracketMatchRow key={m.id} match={m} tournamentSlug={tournamentSlug} />
                  ))}
                </div>
              </div>
            )}
            {sfs.length > 0 && (
              <div>
                <StageRoundHeader stage="SEMIFINAL" matches={sfs} />
                <div className="space-y-1">
                  {sfs.map((m) => (
                    <BracketMatchRow key={m.id} match={m} tournamentSlug={tournamentSlug} />
                  ))}
                </div>
              </div>
            )}
            {final && (
              <div>
                <StageRoundHeader stage="FINAL" matches={[final]} />
                <div className="space-y-1">
                  <BracketMatchRow match={final} tournamentSlug={tournamentSlug} />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Confirm: generate */}
      <AlertDialog open={confirmOpen === 'generate'} onOpenChange={(v) => !v && setConfirmOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generar bracket de Categoría {category.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Se van a crear los partidos de cuartos, semifinales y final.
              {previewInfo && previewInfo.pendingGroupNumbers.length > 0 && (
                <>
                  {' '}
                  <strong>Grupos con resultados pendientes:</strong>{' '}
                  {previewInfo.pendingGroupNumbers.map((n) => `Grupo ${n}`).join(', ')}.
                  Los slots que dependan de estos grupos quedarán con &quot;1°/2° Grupo N&quot; hasta que terminen los partidos del grupo.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runGenerate} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Generar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: regenerate (no advanced matches) */}
      <AlertDialog open={confirmOpen === 'regenerate'} onOpenChange={(v) => !v && setConfirmOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerar bracket de Categoría {category.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Se va a borrar el bracket actual y recalcular con los resultados presentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => runRegenerate(false)} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: regenerate force (destructive) */}
      <AlertDialog open={confirmOpen === 'regenerate-force'} onOpenChange={(v) => !v && setConfirmOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerar (borra partidos confirmados/jugados)</AlertDialogTitle>
            <AlertDialogDescription>
              Hay {advanced} partido(s) del bracket confirmado(s) o jugado(s). Al regenerar se borran junto con sus resultados y reservas. ¿Confirmás?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => runRegenerate(true)} disabled={isPending} className="bg-destructive text-white hover:bg-destructive/90">
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Sí, regenerar igual
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: delete */}
      <AlertDialog open={confirmOpen === 'delete'} onOpenChange={(v) => !v && setConfirmOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar bracket de Categoría {category.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran los partidos de cuartos, semis y final (incluyendo resultados y reservas si existen). La fase de grupos no se toca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runDelete} disabled={isPending} className="bg-destructive text-white hover:bg-destructive/90">
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
