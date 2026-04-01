'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
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

const statusItems = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'PLAYED', label: 'Jugado' },
  { value: 'CANCELLED', label: 'Cancelado' },
]

export function MatchFilters({ tournaments }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTournament = searchParams.get('tournamentId') || ''
  const currentCategory = searchParams.get('categoryId') || ''
  const currentStatus = searchParams.get('status') || ''
  const currentQuery = searchParams.get('q') || ''
  const [query, setQuery] = useState(currentQuery)
  const debounceRef = useRef<NodeJS.Timeout>(undefined)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (query !== currentQuery) updateParams('q', query)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const selectedTournament = tournaments.find((t) => t.id === currentTournament)
  const categories = selectedTournament?.categories ?? []

  const tournamentItems = [
    { value: '', label: 'Todos los torneos' },
    ...tournaments.map((t) => ({ value: t.id, label: t.name })),
  ]
  const categoryItems = [
    { value: '', label: 'Todas' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ]

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
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar jugador..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8 w-52"
        />
      </div>
      <Select value={currentTournament} onValueChange={(v) => updateParams('tournamentId', v ?? '')} items={tournamentItems}>
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

      <Select value={currentCategory} onValueChange={(v) => updateParams('categoryId', v ?? '')} items={categoryItems}>
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

      <Select value={currentStatus} onValueChange={(v) => updateParams('status', v ?? '')} items={statusItems}>
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
