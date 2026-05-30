import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { LadderEntry } from '@/services/ladder-service'

export function LadderTable({ entries }: { entries: LadderEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">La Escalera todavía no fue sembrada.</p>
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:px-4">
        <span className="w-7 text-center">#</span>
        <span className="flex-1">Jugador</span>
        <span className="tabular-nums">Ranking</span>
      </div>
      <div className="divide-y">
        {entries.map((e) => {
          const inner = (
            <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
              <span className="w-7 text-center text-base font-bold tabular-nums text-muted-foreground">
                {e.position}
              </span>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={e.image || undefined} />
                <AvatarFallback className="text-xs">{(e.name[0] || '?').toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
              <span className="shrink-0 text-base font-bold tabular-nums">{e.rating}</span>
            </div>
          )

          return e.playerSlug ? (
            <Link
              key={e.userId}
              href={`/jugador/${e.playerSlug}`}
              className="block transition-colors hover:bg-muted/50"
            >
              {inner}
            </Link>
          ) : (
            <div key={e.userId}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
