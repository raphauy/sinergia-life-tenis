'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MatchResultForm } from '@/components/match-result-form'
import { playerLoadResultAction } from './actions'
import { uploadImage } from '@/services/upload-service'
import { resizeImage } from '@/lib/resize-image'
import type { MatchFormat } from '@prisma/client'
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
  player1Id,
  player2Id,
  player1Name,
  player2Name,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(data: Record<string, unknown>): Promise<ActionResult> {
    return new Promise<ActionResult>((resolve) => {
      startTransition(async () => {
        let photoUrl: string | undefined
        const photoFile = data.photoFile as File | undefined
        delete data.photoFile

        if (photoFile) {
          try {
            const resized = await resizeImage(photoFile)
            const formData = new FormData()
            formData.append('file', new File([resized], 'match-photo.jpg', { type: 'image/jpeg' }))
            const uploadResult = await uploadImage(formData)
            if (uploadResult.success) {
              photoUrl = uploadResult.url
            }
          } catch {
            // Photo upload failed, continue without photo
          }
        }

        const result = await playerLoadResultAction(matchId, { ...data, photoUrl })
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
      player1Id={player1Id}
      player2Id={player2Id}
      player1Name={player1Name}
      player2Name={player2Name}
      onSubmit={handleSubmit}
      isPending={isPending}
    />
  )
}
