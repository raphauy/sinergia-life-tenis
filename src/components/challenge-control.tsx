import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChallengeButton } from '@/components/challenge-button'
import type { LadderRowState } from '@/services/challenge-service'

interface Props {
  state: LadderRowState
  rivalUserId: string
  rivalName: string
  preview?: { ifWin: number; ifLose: number } | null
  /** matchId del partido a jugar (state 'playing'). */
  matchId?: string | null
  /** Panel del viewer, para los links de "Responder" / "A jugar". */
  panelHref: string
  size?: 'sm' | 'default'
}

/** Control de reto según el estado entre el viewer y el rival. Reusado por tabla y perfil. */
export function ChallengeControl({ state, rivalUserId, rivalName, preview, matchId, panelHref, size = 'sm' }: Props) {
  switch (state) {
    case 'none':
      return <ChallengeButton rivalUserId={rivalUserId} rivalName={rivalName} size={size} preview={preview ?? undefined} />
    case 'sent':
      return (
        <span className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground">
          Pendiente
        </span>
      )
    case 'received':
      return (
        <Button size={size} variant="outline" render={<Link href={panelHref} />}>
          Responder
        </Button>
      )
    case 'playing':
      return (
        <Button
          size={size}
          variant="outline"
          render={<Link href={matchId ? `${panelHref}/partidos/${matchId}` : panelHref} />}
        >
          A jugar →
        </Button>
      )
    default:
      return null
  }
}
