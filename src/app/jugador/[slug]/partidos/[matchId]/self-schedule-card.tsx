'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, CalendarCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { format, addDays, startOfDay } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { CLASS_SCHEDULE, COURTS, getSlotsForDay, TIME_SLOTS, TIMEZONE, SELF_SCHEDULE_PAST_DAYS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { selfScheduleMatchAction } from './actions'

interface Props {
  matchId: string
  reservationLeadDays: number
  /** Canchas ya tomadas ("yyyy-MM-dd HH:mm" → nº de cancha). Solo del mes cargado; el
   *  servidor revalida igual, así que una fecha fuera de ese mes no queda sin control. */
  occupiedSlots?: Record<string, number[]>
}

/** Hoy + offset de días, a medianoche, en horario de Uruguay. */
function dayInUY(offsetDays: number) {
  return startOfDay(addDays(toZonedTime(new Date(), TIMEZONE), offsetDays))
}

/**
 * "Ya tengo cancha": el jugador consiguió cancha por su cuenta (por la app del club
 * o fuera del club) y confirma el partido sin esperar al admin. Si la fecha ya pasó,
 * al confirmar puede cargar el resultado en el acto.
 */
export function SelfScheduleCard({ matchId, reservationLeadDays, occupiedSlots = {} }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [location, setLocation] = useState<'CLUB' | 'EXTERNAL'>('CLUB')
  const [date, setDate] = useState<Date | null>(null)
  const [time, setTime] = useState('')
  const [courtNumber, setCourtNumber] = useState('2')

  const minDate = useMemo(() => dayInUY(-SELF_SCHEDULE_PAST_DAYS), [])
  const maxDate = useMemo(() => dayInUY(reservationLeadDays), [reservationLeadDays])
  const dateKey = date ? format(date, 'yyyy-MM-dd') : ''

  // Turnos del club para la fecha elegida, sin clases grupales ni turnos donde la
  // cancha elegida ya está tomada (por eso depende de courtNumber).
  const clubSlots = useMemo(() => {
    if (!date) return []
    const dayOfWeek = date.getDay()
    const classSlots = CLASS_SCHEDULE[dayOfWeek] ?? []
    const court = Number(courtNumber)
    return getSlotsForDay(dayOfWeek).filter(
      (s) => !classSlots.includes(s) && !(occupiedSlots[`${dateKey} ${s}`] ?? []).includes(court)
    )
  }, [date, dateKey, courtNumber, occupiedSlots])

  const clubClosed = date != null && getSlotsForDay(date.getDay()).length === 0

  // Ya jugado: la fecha+hora elegida quedó atrás (en horario de Uruguay).
  const isPast = useMemo(() => {
    if (!dateKey || !time) return false
    const nowUY = format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM-dd'T'HH:mm")
    return `${dateKey}T${time}` <= nowUY
  }, [dateKey, time])

  const canSubmit = date != null && time !== '' && (location === 'EXTERNAL' || courtNumber !== '')

  // Fuera del club no rigen los horarios del club: se ofrece la grilla completa
  // cualquier día (incluso domingo, que acá está cerrado).
  const slotOptions = location === 'CLUB' ? clubSlots : TIME_SLOTS
  const timeItems = useMemo(() => slotOptions.map((s) => ({ value: s, label: s })), [slotOptions])
  const courtItems = useMemo(() => COURTS.map((c) => ({ value: c.number.toString(), label: c.name })), [])

  function handleSubmit() {
    startTransition(async () => {
      const result = await selfScheduleMatchAction(matchId, {
        date: dateKey,
        time,
        location,
        courtNumber: location === 'CLUB' ? courtNumber : undefined,
      })
      if (result.success) {
        toast.success('Partido confirmado')
        router.refresh()
      } else {
        toast.error(result.error || 'Error al agendar el partido')
      }
    })
  }

  return (
    <Collapsible className="mt-4 rounded-lg border bg-card">
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-start gap-2 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted/50">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">¿Ya tenés cancha? Cargala acá</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Si la conseguiste por tu cuenta —por la app del club o fuera del club— confirmá el partido
            directo, sin esperar a Mati.
          </p>
        </div>
        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-4 border-t px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            {(['CLUB', 'EXTERNAL'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { setLocation(opt); setTime('') }}
                className={cn(
                  'cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors',
                  location === opt
                    ? 'border-primary bg-primary/10 font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50',
                )}
              >
                {opt === 'CLUB' ? 'En el club' : 'Fuera del club'}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Fecha</Label>
            <DatePicker
              value={date}
              onChange={(d) => { setDate(d ?? null); setTime('') }}
              minDate={minDate}
              maxDate={maxDate}
            />
          </div>

          <div className={cn('gap-3', location === 'CLUB' ? 'grid grid-cols-2' : 'space-y-2')}>
            <div className="space-y-2">
              <Label htmlFor="self-schedule-time">Hora</Label>
              <Select
                value={time}
                onValueChange={(v) => setTime(v ?? '')}
                items={timeItems}
                disabled={location === 'CLUB' && !date}
              >
                <SelectTrigger id="self-schedule-time" className="w-full">
                  <SelectValue placeholder={location === 'CLUB' && !date ? 'Elegí la fecha' : '—'} />
                </SelectTrigger>
                <SelectContent>
                  {slotOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {location === 'CLUB' && (
              <div className="space-y-2">
                <Label htmlFor="self-schedule-court">Cancha</Label>
                <Select
                  value={courtNumber}
                  // La hora elegida puede no estar libre en la otra cancha.
                  onValueChange={(v) => { setCourtNumber(v ?? ''); setTime('') }}
                  items={courtItems}
                >
                  <SelectTrigger id="self-schedule-court" className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURTS.map((c) => (
                      <SelectItem key={c.number} value={c.number.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {date && clubSlots.length === 0 && location === 'CLUB' && (
            <p className="text-xs text-muted-foreground">
              {clubClosed
                ? 'El club está cerrado ese día.'
                : 'No quedan turnos libres en esa cancha ese día.'}{' '}
              Si jugaron igual en otra cancha, elegí &ldquo;Fuera del club&rdquo;.
            </p>
          )}

          {isPast && (
            <p className="text-xs text-muted-foreground">
              Como el partido ya se jugó, vas a poder cargar el resultado enseguida.
            </p>
          )}

          <Button className="w-full cursor-pointer" onClick={handleSubmit} disabled={isPending || !canSubmit}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
            Confirmar partido
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
