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
  /** Si está seteado (state 'none'): el viewer no puede retar ahora; el botón queda deshabilitado. */
  disabledReason?: string | null
}

/** Control de reto según el estado entre el viewer y el rival. Reusado por tabla y perfil. */
export function ChallengeControl({ state, rivalUserId, rivalName, preview, matchId, panelHref, size = 'sm', disabledReason }: Props) {
  switch (state) {
    case 'none':
      return (
        <ChallengeButton
          rivalUserId={rivalUserId}
          rivalName={rivalName}
          size={size}
          preview={preview ?? undefined}
          disabled={!!disabledReason}
        />
      )
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
