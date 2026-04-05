'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { TIME_SLOTS, COURTS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import type { CalendarMatch } from './court-availability-calendar'
import type { PendingMatch } from '@/app/admin/actions-calendar'

interface Props {
  matches: CalendarMatch[]
  day: Date
  searchAction: (tournamentId: string, query: string) => Promise<PendingMatch[]>
  confirmAction: (matchId: string, date: string, time: string, courtNumber: number) => Promise<{ success: boolean; error?: string }>
  tournamentId: string
  onConfirmed?: () => void
}

function groupByTime(matches: CalendarMatch[]) {
  const map = new Map<string, CalendarMatch[]>()
  for (const m of matches) {
    if (!map.has(m.timeUY)) map.set(m.timeUY, [])
    map.get(m.timeUY)!.push(m)
  }
  return map
}

function formatDateKey(day: Date) {
  return `${day.getFullYear()}-${(day.getMonth() + 1).toString().padStart(2, '0')}-${day.getDate().toString().padStart(2, '0')}`
}

export function AdminDailySchedule({ matches, day, searchAction, confirmAction, tournamentId, onConfirmed }: Props) {
  const firstOccupiedRef = useRef<HTMLDivElement>(null)
  const byTime = groupByTime(matches)

  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const [courtNumber, setCourtNumber] = useState(2)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PendingMatch[]>([])
  const [selectedMatch, setSelectedMatch] = useState<PendingMatch | null>(null)
  const [isSearching, startSearch] = useTransition()
  const [isConfirming, startConfirm] = useTransition()
  const debounceRef = useRef<NodeJS.Timeout>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state when day changes
  useEffect(() => {
    setOpenSlot(null)
    setSelectedMatch(null)
    setQuery('')
    setResults([])
  }, [day])

  // Auto-scroll to first occupied
  useEffect(() => {
    firstOccupiedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [day])

  // Search with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const r = await searchAction(tournamentId, query)
        setResults(r)
      })
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, tournamentId, searchAction])

  const handleSlotClick = useCallback((slot: string) => {
    if (openSlot === slot) {
      setOpenSlot(null)
      setSelectedMatch(null)
      setQuery('')
      return
    }
    setOpenSlot(slot)
    setSelectedMatch(null)
    setQuery('')
    setCourtNumber(2)
    // Focus input after render
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [openSlot])

  const handleConfirm = useCallback(() => {
    if (!selectedMatch || !openSlot) return
    const dateKey = formatDateKey(day)
    startConfirm(async () => {
      const result = await confirmAction(selectedMatch.id, dateKey, openSlot, courtNumber)
      if (result.success) {
        toast.success('Partido confirmado')
        setOpenSlot(null)
        setSelectedMatch(null)
        setQuery('')
        onConfirmed?.()
      } else {
        toast.error(result.error || 'Error al confirmar')
      }
    })
  }, [selectedMatch, openSlot, day, courtNumber, confirmAction, onConfirmed])

  let foundFirst = false

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2 capitalize">
        {day.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })}
      </h3>
      <div className="rounded-lg border overflow-hidden divide-y">
        {TIME_SLOTS.map((slot) => {
          const slotMatches = byTime.get(slot) || []
          const occupied = slotMatches.length
          const isFirst = occupied > 0 && !foundFirst
          if (isFirst) foundFirst = true
          const isOpen = openSlot === slot
          const isFree = occupied < 2

          return (
            <div key={slot} ref={isFirst ? firstOccupiedRef : undefined}>
              {/* Slot row */}
              <div
                className={cn(
                  'flex items-start gap-2 px-3 border-l-3',
                  occupied === 0 && 'py-2 border-l-muted-foreground/20',
                  occupied === 1 && 'py-2 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
                  occupied >= 2 && 'py-2 border-l-red-400 bg-red-50/50 dark:bg-red-950/20',
                  isFree && !isOpen && 'cursor-pointer hover:bg-muted/50 active:bg-muted select-none',
                  isOpen && 'bg-primary/5 border-l-primary',
                )}
                onClick={() => isFree && handleSlotClick(slot)}
              >
                <span className={cn(
                  'text-xs font-mono w-11 shrink-0 pt-0.5',
                  occupied === 0 && !isOpen ? 'text-muted-foreground/50' : 'text-foreground font-medium',
                )}>
                  {slot}
                </span>
                {occupied === 0 && !isOpen ? (
                  <span className="text-xs text-muted-foreground/40">libre</span>
                ) : (
                  <div className="flex-1 min-w-0 space-y-1">
                    {slotMatches.map((m, i) => (
                      <div key={i} className="text-xs leading-tight">
                        <span className="text-muted-foreground">
                          Cancha {m.courtNumber ?? '?'} | Cat {m.categoryName}{m.groupNumber != null ? ` | Grupo ${m.groupNumber}` : ''}
                        </span>
                        <br />
                        <span className="font-medium">
                          {m.player1Name} vs {m.player2Name}
                        </span>
                      </div>
                    ))}
                    {occupied >= 2 && (
                      <p className="text-xs font-medium text-red-600 dark:text-red-400">
                        Sin canchas disponibles
                      </p>
                    )}
                    {occupied === 1 && !isOpen && (
                      <p className="text-xs text-primary/60">+ Asignar cancha libre</p>
                    )}
                  </div>
                )}
                {isOpen && (
                  <button onClick={(e) => { e.stopPropagation(); handleSlotClick(slot) }} className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Expanded slot: search + confirm */}
              {isOpen && (
                <div className="px-3 py-3 bg-primary/5 border-l-3 border-l-primary space-y-3">
                  {/* Court toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Cancha:</span>
                    <div className="flex gap-1">
                      {COURTS.map((c) => (
                        <button
                          key={c.number}
                          onClick={() => setCourtNumber(c.number)}
                          className={cn(
                            'px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer',
                            courtNumber === c.number
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setSelectedMatch(null) }}
                      placeholder="Buscar por nombre de jugador..."
                      className="pl-8 h-9 text-sm"
                    />
                  </div>

                  {/* Results */}
                  {!selectedMatch && (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {isSearching ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : results.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">
                          {query ? 'Sin resultados' : 'No hay partidos pendientes'}
                        </p>
                      ) : (
                        results.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setSelectedMatch(m)}
                            className="w-full text-left px-2.5 py-2 rounded-md text-xs hover:bg-muted/80 active:bg-muted transition-colors cursor-pointer"
                          >
                            <span className="font-medium">{m.player1Name} vs {m.player2Name}</span>
                            <br />
                            <span className="text-muted-foreground">
                              Cat {m.categoryName}{m.groupNumber != null ? ` | Grupo ${m.groupNumber}` : ''}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* Confirmation preview */}
                  {selectedMatch && (
                    <div className="rounded-md border bg-background p-3 space-y-2">
                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-sm">
                          {selectedMatch.player1Name} vs {selectedMatch.player2Name}
                        </p>
                        <p className="text-muted-foreground">
                          Cat {selectedMatch.categoryName}{selectedMatch.groupNumber != null ? ` | Grupo ${selectedMatch.groupNumber}` : ''}
                        </p>
                        <div className="flex items-center gap-2 pt-1 text-foreground font-medium">
                          <span>{day.toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                          <span>·</span>
                          <span>{slot}</span>
                          <span>·</span>
                          <span>{COURTS.find((c) => c.number === courtNumber)?.name}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={handleConfirm}
                          disabled={isConfirming}
                        >
                          {isConfirming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Confirmar partido
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedMatch(null)}
                          disabled={isConfirming}
                        >
                          Cambiar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-2 px-1">
        Cancha 1 suele tener clases. Consultá disponibilidad con Mati.
      </p>
    </div>
  )
}
