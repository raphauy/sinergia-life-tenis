'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resetSeedAction } from './actions'

export function ResetLadderButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  if (disabled) return null

  function reset() {
    startTransition(async () => {
      const res = await resetSeedAction()
      if (res.success) {
        toast.success(res.message ?? 'Escalera reiniciada.')
        setConfirming(false)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        <RotateCcw className="h-4 w-4" />
        Re-sembrar
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">¿Borrar todos los jugadores?</span>
      <Button variant="destructive" size="sm" onClick={reset} disabled={pending}>
        {pending ? 'Borrando…' : 'Sí, re-sembrar'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
        Cancelar
      </Button>
    </div>
  )
}
