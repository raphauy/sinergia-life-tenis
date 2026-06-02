import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatDateUY } from '@/lib/date-utils'
import type { PendingChallengeParty, PublicPendingChallenge } from '@/services/challenge-service'

/**
 * Retos pendientes de toda La Escalera (vista pública de Partidos, read-only):
 * quién retó a quién, los puntos en juego del retador y cuándo vence. Oculto si
 * no hay ninguno.
 */
export function LadderPendingChallenges({ challenges }: { challenges: PublicPendingChallenge[] }) {
  if (challenges.length === 0) return null
  return (
    <section>
      <h2 className="mb-3 text-base font-bold">Retos pendientes ({challenges.length})</h2>
      <div className="space-y-2">
        {challenges.map((c) => (
          <div key={c.id} className="rounded-lg border border-dashed p-3">
            <div className="flex items-center gap-2 text-sm">
              <Party party={c.challenger} />
              <span className="shrink-0 text-xs text-muted-foreground">retó a</span>
              <Party party={c.challenged} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="tabular-nums text-muted-foreground">
                <span className="font-medium text-green-600 dark:text-green-500">+{c.ifWin}</span>
                <span className="text-muted-foreground/50"> / </span>
                <span className="font-medium text-red-600 dark:text-red-500">{c.ifLose}</span>
                <span> · vence {formatDateUY(c.respondByAt, 'dd/MM')}</span>
              </span>
              <Badge variant="warning" className="text-[10px] px-1.5 py-0 shrink-0">
                Pendiente
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Party({ party }: { party: PendingChallengeParty }) {
  const initial = (party.name[0] || '?').toUpperCase()
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarImage src={party.image || undefined} />
        <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
      </Avatar>
      {party.playerSlug ? (
        <Link href={`/jugador/${party.playerSlug}`} className="truncate font-medium hover:underline">
          {party.name}
        </Link>
      ) : (
        <span className="truncate font-medium">{party.name}</span>
      )}
    </div>
  )
}
