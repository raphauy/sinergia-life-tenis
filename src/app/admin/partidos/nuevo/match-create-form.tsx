'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { COURTS } from '@/lib/constants'
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

export function MatchCreateForm({ tournaments }: { tournaments: Tournament[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tournamentId, setTournamentId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [player1Id, setPlayer1Id] = useState('')
  const [player2Id, setPlayer2Id] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  const selectedTournament = tournaments.find((t) => t.id === tournamentId)
  const categories = selectedTournament?.categories ?? []

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
        date: (form.get('date') as string) || undefined,
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Torneo</Label>
        <Select value={tournamentId} onValueChange={(v) => { setTournamentId(v ?? ''); setCategoryId('') }}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar torneo" />
          </SelectTrigger>
          <SelectContent>
            {tournaments.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Categoría</Label>
        <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? '')} disabled={!tournamentId}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar categoría" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Jugador 1</Label>
        <Select value={player1Id} onValueChange={(v) => setPlayer1Id(v ?? '')} disabled={loadingPlayers || players.length === 0}>
          <SelectTrigger>
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
        <Select value={player2Id} onValueChange={(v) => setPlayer2Id(v ?? '')} disabled={loadingPlayers || players.length === 0}>
          <SelectTrigger>
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

      <div className="border-t pt-4 mt-4">
        <p className="text-sm text-muted-foreground mb-3">Programación (opcional)</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="date">Fecha</Label>
            <Input id="date" name="date" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Hora</Label>
            <Input id="time" name="time" type="time" />
          </div>
          <div className="space-y-2">
            <Label>Cancha</Label>
            <Select name="courtNumber">
              <SelectTrigger>
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
