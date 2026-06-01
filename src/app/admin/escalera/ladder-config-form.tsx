'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
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
import { updateLadderConfigAction } from './actions'

// Solo los formatos que la carga de resultado soporta hoy.
type LadderMatchFormat = 'SINGLE_SET' | 'TWO_SETS_SUPERTB'

const formatItems: { value: LadderMatchFormat; label: string }[] = [
  { value: 'SINGLE_SET', label: '1 set' },
  { value: 'TWO_SETS_SUPERTB', label: '2 sets + súper tie-break' },
]

export interface LadderConfig {
  kFactor: number
  matchFormat: string
  maxOpenChallenges: number
  maxChallengesPerMonth: number
  acceptanceWindowDays: number
  rematchCooldownDays: number
  matchScheduleDeadlineDays: number
  reservationLeadDays: number
  minMatchesPerMonth: number
  monthlyPenalty: number
  seedBaseRating: number
  seedStep: number
}

// Campos numéricos editables (clave → metadata). El orden define el render.
const NUM_FIELDS = [
  { key: 'kFactor', label: 'Factor K', hint: 'Cuánto se mueve el rating por partido. Más alto = cambios más bruscos.', min: 1, max: 100, group: 'puntaje' },
  { key: 'maxOpenChallenges', label: 'Retos abiertos a la vez', hint: 'Cuántos retos sin cerrar puede tener un jugador.', min: 1, max: 20, group: 'retos' },
  { key: 'maxChallengesPerMonth', label: 'Retos por mes', hint: 'Tope de retos que un jugador inicia por mes.', min: 1, max: 50, group: 'retos' },
  { key: 'acceptanceWindowDays', label: 'Días para responder', hint: 'Plazo del retado para aceptar o rechazar antes de que venza.', min: 1, max: 30, group: 'retos' },
  { key: 'rematchCooldownDays', label: 'Cooldown de revancha (días)', hint: 'Días de espera para volver a retar al mismo rival tras jugar. 0 = sin espera.', min: 0, max: 60, group: 'retos' },
  { key: 'matchScheduleDeadlineDays', label: 'Días para concretar', hint: 'Días para jugar el partido aceptado antes de mostrar el recordatorio de cancelar.', min: 1, max: 30, group: 'partidos' },
  { key: 'reservationLeadDays', label: 'Anticipación de reserva (días)', hint: 'Hasta cuántos días adelante se pueden reservar canchas.', min: 1, max: 120, group: 'partidos' },
  { key: 'minMatchesPerMonth', label: 'Mínimo de partidos al mes', hint: 'Partidos esperados por mes (se aplicará en la Fase 3).', min: 0, max: 30, group: 'fase3' },
  { key: 'monthlyPenalty', label: 'Penalización mensual', hint: 'Puntos a descontar por no llegar al mínimo (se aplicará en la Fase 3).', min: 0, max: 500, group: 'fase3' },
] as const

const GROUPS: { id: string; title: string }[] = [
  { id: 'puntaje', title: 'Puntaje (ELO)' },
  { id: 'retos', title: 'Retos' },
  { id: 'partidos', title: 'Partidos' },
  { id: 'fase3', title: 'Actividad mínima (Fase 3)' },
]

type FormState = Record<string, string> & { matchFormat: string }

export function LadderConfigForm({ config }: { config: LadderConfig }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(() => {
    const base: FormState = { matchFormat: config.matchFormat }
    for (const f of NUM_FIELDS) base[f.key] = String(config[f.key as keyof LadderConfig])
    return base
  })

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function submit() {
    // Parseo + validación de rango en el cliente; el schema del server es backstop.
    const payload: Record<string, unknown> = { matchFormat: form.matchFormat }
    for (const f of NUM_FIELDS) {
      const n = Number(form[f.key])
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < f.min || n > f.max) {
        toast.error(`"${f.label}" debe ser un entero entre ${f.min} y ${f.max}.`)
        return
      }
      payload[f.key] = n
    }
    startTransition(async () => {
      const res = await updateLadderConfigAction(payload)
      if (res.success) {
        toast.success(res.message ?? 'Configuración guardada.')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Formato de partido */}
      <div className="space-y-1.5">
        <Label>Formato de partido</Label>
        <Select
          value={form.matchFormat}
          onValueChange={(v) => v && setField('matchFormat', v)}
          items={formatItems}
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Formato" />
          </SelectTrigger>
          <SelectContent>
            {formatItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Aplica a los partidos nuevos de la escalera.</p>
      </div>

      {GROUPS.map((g) => (
        <div key={g.id} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">{g.title}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {NUM_FIELDS.filter((f) => f.group === g.id).map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input
                  id={f.key}
                  type="number"
                  inputMode="numeric"
                  min={f.min}
                  max={f.max}
                  value={form[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="w-28"
                />
                <p className="text-xs text-muted-foreground">{f.hint}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Siembra: read-only (ya no aplica con la escalera sembrada) */}
      <div className="space-y-2 rounded-md border border-dashed bg-muted/30 p-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Siembra (solo lectura)</h3>
        <p className="text-xs text-muted-foreground">
          Rating del puesto 1: <span className="font-medium text-foreground">{config.seedBaseRating}</span> · paso por
          puesto: <span className="font-medium text-foreground">−{config.seedStep}</span>. Solo se usan al sembrar; la
          escalera ya está sembrada.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </div>
    </div>
  )
}
