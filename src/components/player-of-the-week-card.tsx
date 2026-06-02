import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Trophy } from 'lucide-react'
import type { PlayerOfTheWeek } from '@/services/ladder-stats-service'

/** Reconocimiento al miembro que más puntos ganó en la semana recién cerrada. */
export function PlayerOfTheWeekCard({ player }: { player: PlayerOfTheWeek }) {
  const inner = (
    <div className="flex items-center gap-3 rounded-lg border bg-gradient-to-r from-amber-50 to-transparent p-4 dark:from-amber-950/30">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
        <Trophy className="h-5 w-5" />
      </div>
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={player.image || undefined} />
        <AvatarFallback>{(player.name[0] || '?').toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Jugador de la semana
        </p>
        <p className="truncate font-semibold">{player.name}</p>
      </div>
      <span className="shrink-0 text-sm font-bold tabular-nums text-green-600 dark:text-green-500">
        +{player.netGain}
      </span>
    </div>
  )

  return player.playerSlug ? (
    <Link href={`/jugador/${player.playerSlug}`} className="block transition-opacity hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  )
}
