'use client'

import { useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { setFeaturedOnHomeAction } from './actions'

interface Props {
  tournamentSlug: string
  tournamentId: string
  featuredOnHome: boolean
}

export function FeaturedOnHomeSwitch({ tournamentSlug, tournamentId, featuredOnHome }: Props) {
  const [checked, setChecked] = useState(featuredOnHome)
  const [isPending, startTransition] = useTransition()

  function handleChange(value: boolean) {
    const previous = checked
    setChecked(value)
    startTransition(async () => {
      const result = await setFeaturedOnHomeAction(tournamentSlug, tournamentId, value)
      if (result.success) {
        toast.success(value ? 'El torneo está en portada' : 'El torneo salió de la portada')
      } else {
        setChecked(previous)
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3 mb-6">
      <div className="space-y-0.5">
        <Label htmlFor="featuredOnHome" className="cursor-pointer">
          Torneo en portada
        </Label>
        <p className="text-xs text-muted-foreground">
          Mientras esté prendido, el home muestra este torneo. Al prenderlo se apaga en cualquier otro torneo.
        </p>
      </div>
      <Switch
        id="featuredOnHome"
        checked={checked}
        disabled={isPending}
        onCheckedChange={(value) => handleChange(value === true)}
      />
    </div>
  )
}
