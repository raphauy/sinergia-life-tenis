'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { acceptPlayerInvitationAction } from './actions'

export function AcceptPlayerInvitation({ token }: { token: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptPlayerInvitationAction(token)
      if (result.success) {
        toast.success('Invitación aceptada. Ya podés iniciar sesión.')
        router.push('/login')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Button onClick={handleAccept} disabled={isPending} className="w-full">
      {isPending ? 'Aceptando...' : 'Aceptar invitación'}
    </Button>
  )
}
