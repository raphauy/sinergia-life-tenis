import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDateUY, friendlyDateTimeUY } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { MemberChallengeCard } from '@/services/challenge-service'

const STATUS_LABEL: Record<MemberChallengeCard['kind'], string> = {
  received: 'Reto recibido',
  sent: 'Reto enviado',
  playing: 'A jugar',
}

// Cuando el rival del reto es el propio viewer, lo personalizamos en 2da persona.
const STATUS_LABEL_VIEWER: Record<MemberChallengeCard['kind'], string> = {
  received: 'Retado por ti',
  sent: 'Te retó',
  playing: 'A jugar',
}

/**
 * Retos vivos del jugador en vista pública (read-only), estilo bandeja de retos
 * pero sin acciones. Lo ve quien no es el dueño del perfil.
 */
export function PublicChallenges({
  challenges,
  viewerUserId,
}: {
  challenges: MemberChallengeCard[]
  viewerUserId?: string | null
}) {
  if (challenges.length === 0) return null
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Retos</h2>
      <div className="space-y-2">
        {challenges.map((c) => {
          const dateLabel =
            c.kind === 'playing'
              ? c.scheduledAt
                ? friendlyDateTimeUY(c.scheduledAt)
                : 'a coordinar'
              : c.respondByAt
                ? `vence ${formatDateUY(c.respondByAt)}`
                : null

          const isViewer = !!viewerUserId && c.rival.userId === viewerUserId
          const statusLabel = (isViewer ? STATUS_LABEL_VIEWER : STATUS_LABEL)[c.kind]

          return (
            <div
              key={c.id}
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg border p-3',
                c.kind === 'sent' && 'border-dashed'
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={c.rival.image || undefined} />
                  <AvatarFallback className="text-xs">{(c.rival.name[0] || '?').toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  {c.rival.playerSlug ? (
                    <Link href={`/jugador/${c.rival.playerSlug}`} className="block truncate font-medium hover:underline">
                      {c.rival.name}
                    </Link>
                  ) : (
                    <p className="truncate font-medium">{c.rival.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Ranking #{c.rival.position} · {c.rival.rating} puntos
                  </p>
                  <p className="text-xs">
                    <span className="font-semibold text-green-600 tabular-nums dark:text-green-500">+{c.ifWin}</span>
                    <span className="text-muted-foreground/50"> / </span>
                    <span className="font-semibold text-red-600 tabular-nums dark:text-red-500">{c.ifLose}</span>
                    {dateLabel && <span className="text-muted-foreground"> · {dateLabel}</span>}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">{statusLabel}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
