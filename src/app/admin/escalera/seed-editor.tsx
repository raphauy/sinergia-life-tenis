'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronUp, ChevronDown, X, Trophy } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { commitSeedAction } from './actions'
import type { SeedProposalItem } from '@/services/ladder-service'

interface SeedEditorProps {
  proposal: SeedProposalItem[]
  baseRating: number
  step: number
  tournamentName: string
}

type Row = SeedProposalItem & { email: string }

export function SeedEditor({ proposal, baseRating, step, tournamentName }: SeedEditorProps) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(() => proposal.map((p) => ({ ...p, email: p.email ?? '' })))
  const [pending, startTransition] = useTransition()

  const missingEmail = useMemo(
    () => rows.filter((r) => !r.userId && r.email.trim() === '').length,
    [rows]
  )

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= rows.length) return
    setRows((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function remove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function setEmail(index: number, email: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, email } : r)))
  }

  function submit() {
    if (rows.length === 0) {
      toast.error('No hay jugadores para sembrar.')
      return
    }
    if (missingEmail > 0) {
      toast.error('Resolvé los emails faltantes antes de bloquear.')
      return
    }
    startTransition(async () => {
      const items = rows.map((r) => ({
        playerId: r.playerId,
        userId: r.userId,
        email: r.email.trim() || null,
        firstName: r.firstName,
        lastName: r.lastName,
      }))
      const res = await commitSeedAction({ items })
      if (res.success) {
        toast.success(res.message ?? 'La Escalera se sembró.')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Sembrar La Escalera</h1>
        <p className="text-sm text-muted-foreground">
          Orden propuesto desde <span className="font-medium">{tournamentName}</span>. Reordená, quitá
          jugadores y resolvé los emails faltantes. Al confirmar se crea la escalera con {rows.length}{' '}
          jugadores y sus puntos iniciales.
        </p>
      </div>

      {/* Barra de acción sticky para que el botón esté siempre a mano (mobile) */}
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur md:mx-0 md:rounded-md md:border md:px-3">
        <div className="text-sm">
          <span className="font-semibold">{rows.length}</span> jugadores
          {missingEmail > 0 && (
            <span className="ml-2 text-destructive">· {missingEmail} sin email</span>
          )}
        </div>
        <Button onClick={submit} disabled={pending || rows.length === 0 || missingEmail > 0}>
          <Trophy className="h-4 w-4" />
          {pending ? 'Sembrando…' : 'Confirmar y bloquear'}
        </Button>
      </div>

      <ol className="rounded-md border divide-y">
        {rows.map((r, i) => {
          const rating = baseRating - step * i
          const needsEmail = !r.userId
          return (
            <li key={r.playerId} className="px-2 py-2 sm:px-3">
              <div className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums">{i + 1}</span>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={r.image || undefined} />
                  <AvatarFallback className="text-xs">
                    {(r.displayName[0] || '?').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.displayName}</div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                      {r.categoryName}
                    </Badge>
                    {needsEmail && (
                      <span className="text-[10px] font-medium text-muted-foreground">sin cuenta</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums">{rating}</span>
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Subir"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => move(i, 1)}
                    disabled={i === rows.length - 1}
                    aria-label="Bajar"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(i)}
                    aria-label="Quitar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {needsEmail && (
                <div className="mt-2 pl-8">
                  <Input
                    type="email"
                    inputMode="email"
                    placeholder="Email para crear la cuenta…"
                    value={r.email}
                    onChange={(e) => setEmail(i, e.target.value)}
                    aria-invalid={r.email.trim() === ''}
                    className={r.email.trim() === '' ? 'border-destructive' : undefined}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
