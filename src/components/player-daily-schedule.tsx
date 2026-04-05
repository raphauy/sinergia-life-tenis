'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { CLASS_SCHEDULE, getSlotsForDay, COURTS, getMinReservationDate } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CalendarCheck, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { CalendarMatch, CalendarReservation } from './court-availability-calendar'

interface Props {
  matches: CalendarMatch[]
  reservations: CalendarReservation[]
  day: Date
  matchId: string
  currentReservation: CalendarReservation | null // reserva activa de este partido
  createAction: (matchId: string, date: string, time: string) => Promise<{ success: boolean; error?: string }>
  cancelAction: (matchId: string) => Promise<{ success: boolean; error?: string }>
  onChanged?: () => void
}

function groupByTime<T extends { timeUY: string }>(items: T[]) {
  const map = new Map<string, T[]>()
  for (const item of items) {
    if (!map.has(item.timeUY)) map.set(item.timeUY, [])
    map.get(item.timeUY)!.push(item)
  }
  return map
}

function hasClass(dayOfWeek: number, slot: string) {
  return CLASS_SCHEDULE[dayOfWeek]?.includes(slot) ?? false
}

function formatDateKey(day: Date) {
  return `${day.getFullYear()}-${(day.getMonth() + 1).toString().padStart(2, '0')}-${day.getDate().toString().padStart(2, '0')}`
}

export function PlayerDailySchedule({
  matches, reservations, day, matchId, currentReservation,
  createAction, cancelAction, onChanged,
}: Props) {
  const firstOccupiedRef = useRef<HTMLDivElement>(null)
  const byTime = groupByTime(matches)
  const reservationsByTime = groupByTime(reservations)
  const dayOfWeek = day.getDay()
  const slots = getSlotsForDay(dayOfWeek)
  const minDate = getMinReservationDate(new Date())
  const dayTooSoon = day < minDate

  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setOpenSlot(null)
  }, [day])

  useEffect(() => {
    firstOccupiedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [day])

  const handleSlotClick = useCallback((slot: string) => {
    if (currentReservation) return // ya tiene reserva
    setOpenSlot((prev) => prev === slot ? null : slot)
  }, [currentReservation])

  const handleReserve = useCallback((slot: string) => {
    const dateKey = formatDateKey(day)
    startTransition(async () => {
      const result = await createAction(matchId, dateKey, slot)
      if (result.success) {
        toast.success('Horario reservado')
        setOpenSlot(null)
        onChanged?.()
      } else {
        toast.error(result.error || 'Error al reservar')
      }
    })
  }, [day, matchId, createAction, onChanged])

  const handleCancel = useCallback(() => {
    startTransition(async () => {
      const result = await cancelAction(matchId)
      if (result.success) {
        toast.success('Reserva cancelada')
        onChanged?.()
      } else {
        toast.error(result.error || 'Error al cancelar')
      }
    })
  }, [matchId, cancelAction, onChanged])

  let foundFirst = false

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2 capitalize">
        {day.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })}
      </h3>

      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Club cerrado</p>
      ) : (
      <div className="rounded-lg border overflow-hidden divide-y">
        {slots.map((slot) => {
          const slotMatches = byTime.get(slot) || []
          const slotReservations = reservationsByTime.get(slot) || []
          const occupied = slotMatches.length
          const reserved = slotReservations.length
          const total = occupied + reserved
          const isClass = hasClass(dayOfWeek, slot)
          const isFirst = (total > 0 || isClass) && !foundFirst
          if (isFirst) foundFirst = true
          const isOpen = openSlot === slot
          const canReserve = !isClass && total === 0 && !currentReservation && !dayTooSoon

          return (
            <div key={slot} ref={isFirst ? firstOccupiedRef : undefined}>
              <div
                className={cn(
                  'flex items-start gap-2 px-3 border-l-3',
                  isClass && 'py-1.5 border-l-violet-400 bg-violet-50/50 dark:bg-violet-950/20',
                  !isClass && total === 0 && 'py-1.5 border-l-muted-foreground/20',
                  !isClass && reserved > 0 && occupied === 0 && 'py-2 border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/20',
                  !isClass && occupied > 0 && total < 2 && 'py-2 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
                  !isClass && total >= 2 && 'py-2 border-l-red-400 bg-red-50/50 dark:bg-red-950/20',
                  canReserve && !isOpen && 'cursor-pointer hover:bg-muted/50 active:bg-muted select-none',
                  isOpen && 'bg-primary/5 border-l-primary',
                )}
                onClick={() => canReserve && handleSlotClick(slot)}
              >
                <span className={cn(
                  'text-xs font-mono w-11 shrink-0 pt-0.5',
                  !isClass && total === 0 && !isOpen ? 'text-muted-foreground/50' : 'text-foreground font-medium',
                )}>
                  {slot}
                </span>
                {isClass ? (
                  <span className="text-xs text-violet-600 dark:text-violet-400">Reservado para clase grupal</span>
                ) : total === 0 && !isOpen ? (
                  canReserve ? (
                    <span className="text-xs text-primary font-medium">Reservar</span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40" />
                  )
                ) : (
                  <div className="flex-1 min-w-0 space-y-1">
                    {slotMatches.map((m, i) => (
                      <div key={`m-${i}`} className="text-xs leading-tight">
                        <span className="text-muted-foreground">
                          Cancha {m.courtNumber ?? '?'} | Cat {m.categoryName}{m.groupNumber != null ? ` | Grupo ${m.groupNumber}` : ''}
                        </span>
                        <br />
                        <span className="font-medium">{m.player1Name} vs {m.player2Name}</span>
                      </div>
                    ))}
                    {slotReservations.map((r, i) => {
                      const isMine = r.matchId === matchId
                      return (
                        <div key={`r-${i}`} className="text-xs leading-tight flex items-start justify-between gap-2">
                          <div>
                            <span className="text-blue-600 dark:text-blue-400 font-medium">Reservado</span>
                            <span className="text-muted-foreground">
                              {' '}| Cat {r.categoryName}{r.groupNumber != null ? ` | Grupo ${r.groupNumber}` : ''}
                            </span>
                            <br />
                            <span className="font-medium">{r.player1Name} vs {r.player2Name}</span>
                          </div>
                          {isMine && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); handleCancel() }}
                              disabled={isPending}
                              className="shrink-0 h-6 text-[10px] px-1.5 cursor-pointer"
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {isOpen && (
                  <button onClick={(e) => { e.stopPropagation(); setOpenSlot(null) }} className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Reserve confirmation */}
              {isOpen && (
                <div className="px-3 py-3 bg-primary/5 border-l-3 border-l-primary">
                  <div className="rounded-md border bg-background p-3 space-y-2">
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-sm">Reservar este horario</p>
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <span>{day.toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                        <span>·</span>
                        <span>{slot}</span>
                        <span>·</span>
                        <span>Cancha 2</span>
                      </div>
                      <p className="text-muted-foreground">Mati confirmará tu reserva y te llegará un email</p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full cursor-pointer"
                      onClick={() => handleReserve(slot)}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CalendarCheck className="h-4 w-4" />
                      )}
                      Reservar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
