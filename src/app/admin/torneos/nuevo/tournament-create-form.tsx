'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/ui/date-picker'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { createTournamentAction } from '../actions'
import { DEFAULT_CATEGORIES } from '@/lib/constants'

export function TournamentCreateForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [categories, setCategories] = useState<string[]>([...DEFAULT_CATEGORIES])
  const [newCategory, setNewCategory] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()

  function addCategory() {
    const cat = newCategory.trim().toUpperCase()
    if (cat && !categories.includes(cat)) {
      setCategories([...categories, cat])
      setNewCategory('')
    }
  }

  function removeCategory(cat: string) {
    setCategories(categories.filter((c) => c !== cat))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)

    if (!(form.get('name') as string)?.trim()) {
      toast.error('Nombre del torneo requerido')
      return
    }
    if (!startDate || !endDate) {
      toast.error('Seleccioná fecha de inicio y fin')
      return
    }

    startTransition(async () => {
      const result = await createTournamentAction({
        name: form.get('name') as string,
        description: (form.get('description') as string) || undefined,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        categories,
      })

      if (result.success && result.data) {
        toast.success('Torneo creado')
        router.push(`/admin/torneos/${result.data.id}`)
      } else if (!result.success) {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" placeholder="Torneo Apertura 2026" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fecha inicio</Label>
          <DatePicker
            value={startDate}
            onChange={(d) => setStartDate(d)}
            placeholder="Seleccionar fecha"
          />
        </div>
        <div className="space-y-2">
          <Label>Fecha fin</Label>
          <DatePicker
            value={endDate}
            onChange={(d) => setEndDate(d)}
            placeholder="Seleccionar fecha"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Categorías</Label>
        <div className="flex gap-1 flex-wrap mb-2">
          {categories.map((cat) => (
            <Badge key={cat} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeCategory(cat)}>
              {cat}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Nueva categoría"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCategory()
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addCategory}>
            Agregar
          </Button>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isPending || categories.length === 0}>
        {isPending ? 'Creando...' : 'Crear torneo'}
      </Button>
    </form>
  )
}
