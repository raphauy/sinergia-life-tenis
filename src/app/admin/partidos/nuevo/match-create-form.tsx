'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CategoryBadge } from '@/components/category-badge'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { COURTS, TIME_SLOTS } from '@/lib/constants'
import { createMatchAction, getPlayersByCategoryAction } from '../actions'

interface Tournament {
  id: string
  name: string
  categories: Array<{ id: string; name: string }>
}

interface Player {
  id: string
  name: string
  userId: string
}

const timeItems = TIME_SLOTS.map((t) => ({ value: t, label: t }))
const courtItems = COURTS.map((c) => ({ value: c.number.toString(), label: c.name }))

export function MatchCreateForm({ tournaments }: { tournaments: Tournament[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tournamentId, setTournamentId] = useState(() => tournaments.length === 1 ? tournaments[0].id : '')
  const [categoryId, setCategoryId] = useState('')
  const [player1Id, setPlayer1Id] = useState('')
  const [player2Id, setPlayer2Id] = useState('')
  const [matchDate, setMatchDate] = useState<Date | undefined>()
  const [players, setPlayers] = useState<Player[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  const selectedTournament = tournaments.find((t) => t.id === tournamentId)
  const categories = selectedTournament?.categories ?? []

  const tournamentItems = tournaments.map((t) => ({ value: t.id, label: t.name }))
  const playerItems = players.map((p) => ({ value: p.id, label: p.name }))

  // Auto-select first category
  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id)
    }
  }, [categories, categoryId])

  useEffect(() => {
    if (!categoryId) {
      setPlayers([])
      setPlayer1Id('')
      setPlayer2Id('')
      return
    }
    setLoadingPlayers(true)
    getPlayersByCategoryAction(categoryId).then((result) => {
      if (result.success && result.data) {
        setPlayers(result.data)
      } else {
        setPlayers([])
      }
      setLoadingPlayers(false)
      setPlayer1Id('')
      setPlayer2Id('')
    })
  }, [categoryId])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createMatchAction({
        tournamentId,
        categoryId,
        player1Id: players.find((p) => p.id === player1Id)?.userId || '',
        player2Id: players.find((p) => p.id === player2Id)?.userId || '',
        courtNumber: form.get('courtNumber') || undefined,
        date: matchDate ? format(matchDate, 'yyyy-MM-dd') : undefined,
        time: (form.get('time') as string) || undefined,
      })

      if (result.success && result.data) {
        toast.success('Partido creado')
        router.push(`/admin/partidos/${result.data.id}`)
      } else if (!result.success) {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      {/* Torneo + Categoría */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="space-y-2 sm:flex-1">
          <Label>Torneo</Label>
          <Select value={tournamentId} onValueChange={(v) => { setTournamentId(v ?? ''); setCategoryId('') }} items={tournamentItems}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar torneo" />
            </SelectTrigger>
            <SelectContent>
              {tournaments.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {categories.length > 0 && (
          <div className="space-y-2">
            <Label>Categoría</Label>
            <div className="flex gap-1.5 items-center">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(categoryId === c.id ? '' : c.id)}
                >
                  <CategoryBadge
                    name={c.name}
                    className={cn(
                      'cursor-pointer transition-all text-sm h-8 px-3',
                      categoryId === c.id && 'ring-2 ring-foreground scale-110'
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Jugador 1 + Jugador 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Jugador 1</Label>
          <Select value={player1Id} onValueChange={(v) => setPlayer1Id(v ?? '')} disabled={loadingPlayers || players.length === 0} items={playerItems}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loadingPlayers ? 'Cargando...' : 'Seleccionar jugador'} />
            </SelectTrigger>
            <SelectContent>
              {players
                .filter((p) => p.id !== player2Id)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Jugador 2</Label>
          <Select value={player2Id} onValueChange={(v) => setPlayer2Id(v ?? '')} disabled={loadingPlayers || players.length === 0} items={playerItems}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar jugador" />
            </SelectTrigger>
            <SelectContent>
              {players
                .filter((p) => p.id !== player1Id)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Programación */}
      <div className="border-t pt-4">
        <p className="text-sm text-muted-foreground mb-3">Programación (opcional)</p>
        <div className="grid grid-cols-[1fr_auto_auto] gap-3">
          <div className="space-y-2">
            <Label>Fecha</Label>
            <DatePicker value={matchDate} onChange={setMatchDate} />
          </div>
          <div className="space-y-2">
            <Label>Hora</Label>
            <Select name="time" items={timeItems}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cancha</Label>
            <Select name="courtNumber" items={courtItems}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {COURTS.map((c) => (
                  <SelectItem key={c.number} value={c.number.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isPending || !tournamentId || !categoryId || !player1Id || !player2Id}
      >
        {isPending ? 'Creando...' : 'Crear partido'}
      </Button>
    </form>
  )
}
