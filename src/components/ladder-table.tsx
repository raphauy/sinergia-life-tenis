import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChallengeControl } from '@/components/challenge-control'
import { cn } from '@/lib/utils'
import type { LadderRow } from '@/services/challenge-service'

interface Props {
  rows: LadderRow[]
  canChallenge?: boolean
  currentPlayerSlug?: string | null
}

export function LadderTable({ rows, canChallenge, currentPlayerSlug }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">La Escalera todavía no fue sembrada.</p>
  }

  const panelHref = currentPlayerSlug ? `/jugador/${currentPlayerSlug}` : '/'

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:px-4">
        <span className="w-7 text-center">#</span>
        <span className="flex-1">Jugador</span>
        <span className="tabular-nums">Ranking</span>
      </div>
      <div className="divide-y">
        {rows.map((e) => {
          const isSelf = e.state === 'self'
          const showSecondRow = !!canChallenge && !isSelf

          return (
            <div
              key={e.userId}
              className={cn('flex items-center gap-3 px-3 py-1.5 sm:px-4', isSelf && 'bg-primary/5')}
            >
              {/* Columna izquierda: identidad (arriba) + preview/control (abajo) */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  {/* La flecha de posición del mes (Fase 4) irá dentro de este bloque */}
                  <span className="w-7 shrink-0 text-center text-base font-bold tabular-nums text-muted-foreground">
                    {e.position}
                  </span>
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={e.image || undefined} />
                    <AvatarFallback className="text-xs">{(e.name[0] || '?').toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {e.playerSlug ? (
                    <Link href={`/jugador/${e.playerSlug}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                      {e.name}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
                  )}
                  {isSelf && (
                    <span className="shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      tu puesto
                    </span>
                  )}
                </div>

                {/* Preview ELO + control de reto, juntos a la izquierda */}
                {showSecondRow && (
                  <div className="mt-0.5 flex items-center gap-3 pl-10">
                    {e.state === 'none' && e.ifWin != null && e.ifLose != null && (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs"
                        title={`Ganás ${e.ifWin}, perdés ${Math.abs(e.ifLose)}`}
                      >
                        <span className="font-semibold text-green-600 tabular-nums dark:text-green-500">+{e.ifWin}</span>
                        <span className="text-muted-foreground/40">/</span>
                        <span className="font-semibold text-red-600 tabular-nums dark:text-red-500">{e.ifLose}</span>
                      </span>
                    )}
                    <ChallengeControl
                      state={e.state}
                      rivalUserId={e.userId}
                      rivalName={e.name}
                      preview={e.ifWin != null && e.ifLose != null ? { ifWin: e.ifWin, ifLose: e.ifLose } : null}
                      matchId={e.matchId}
                      panelHref={panelHref}
                    />
                  </div>
                )}
              </div>

              {/* Ranking: centrado verticalmente respecto a toda la fila */}
              <span className="shrink-0 text-base font-bold tabular-nums">{e.rating}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
