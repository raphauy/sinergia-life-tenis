'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MatchResultForm } from '@/components/match-result-form'
import { playerLoadResultAction } from './actions'
import type { MatchFormat } from '@/generated/prisma/client'
import type { ActionResult } from '@/lib/action-types'

interface Props {
  matchId: string
  playerId: string
  matchFormat: MatchFormat
  player1Id: string
  player2Id: string
  player1Name: string
  player2Name: string
}

export function PlayerLoadResult({
  matchId,
  matchFormat,
  player1Name,
  player2Name,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(data: Record<string, unknown>): Promise<ActionResult> {
    return new Promise<ActionResult>((resolve) => {
      startTransition(async () => {
        const result = await playerLoadResultAction(matchId, data)
        if (result.success) {
          toast.success('Resultado cargado')
          router.refresh()
        }
        resolve(result)
      })
    })
  }

  return (
    <MatchResultForm
      matchFormat={matchFormat}
      player1Name={player1Name}
      player2Name={player2Name}
      onSubmit={handleSubmit}
      isPending={isPending}
    />
  )
}
