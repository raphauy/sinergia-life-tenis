'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  tournaments: Array<{
    id: string
    name: string
    categories: Array<{ id: string; name: string }>
  }>
}

export function MatchFilters({ tournaments }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTournament = searchParams.get('tournamentId') || ''
  const currentCategory = searchParams.get('categoryId') || ''
  const currentStatus = searchParams.get('status') || ''

  const selectedTournament = tournaments.find((t) => t.id === currentTournament)
  const categories = selectedTournament?.categories ?? []

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    // Reset category when tournament changes
    if (key === 'tournamentId') params.delete('categoryId')
    router.push(`/admin/partidos?${params.toString()}`)
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Select value={currentTournament} onValueChange={(v) => updateParams('tournamentId', v ?? '')}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Todos los torneos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todos los torneos</SelectItem>
          {tournaments.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentCategory} onValueChange={(v) => updateParams('categoryId', v ?? '')}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todas</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentStatus} onValueChange={(v) => updateParams('status', v ?? '')}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todos</SelectItem>
          <SelectItem value="PENDING">Pendiente</SelectItem>
          <SelectItem value="CONFIRMED">Confirmado</SelectItem>
          <SelectItem value="PLAYED">Jugado</SelectItem>
          <SelectItem value="CANCELLED">Cancelado</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
