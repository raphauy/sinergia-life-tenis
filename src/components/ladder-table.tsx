import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChallengeControl } from '@/components/challenge-control'
import { PositionDelta } from '@/components/position-delta'
import { ActivityLine, PointsPair } from '@/components/ladder-activity-line'
import { cn } from '@/lib/utils'
import type { LadderRow } from '@/services/challenge-service'

interface Props {
  rows: LadderRow[]
  canChallenge?: boolean
  currentPlayerSlug?: string | null
  /** userId del viewer logueado: para no duplicar su propio reto (ya lo cubre el control). */
  viewerUserId?: string | null
  /** Movimiento de puesto del mes por userId (↑/↓). */
  movement?: Map<string, number>
}

export function LadderTable({ rows, canChallenge, currentPlayerSlug, viewerUserId, movement }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">La Escalera todavía no fue sembrada.</p>
  }

  const panelHref = currentPlayerSlug ? `/jugador/${currentPlayerSlug}` : '/'

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:px-4">
        <span className="w-7 text-center">#</span>
        <span className="flex-1">Jugador</span>
        <span className="tabular-nums">Puntos</span>
      </div>
      <div className="divide-y">
        {rows.map((e) => {
          const isSelf = e.state === 'self'
          // El control (acción del viewer) solo para estados accionables; 'sent' no
          // lleva control (el "Retó a X" ya aparece en la fila propia del viewer).
          const showControl =
            !!canChallenge && !isSelf && (e.state === 'none' || e.state === 'received' || e.state === 'playing')
          // Mostrar toda la actividad del jugador (incluido el reto que involucra al
          // propio viewer, con etiqueta "ti"), igual que en la vista pública. El
          // control aporta la acción; la línea, el contexto.
          const infoActivities = e.activities

          return (
            <div
              key={e.userId}
              className={cn('flex items-center gap-3 px-3 py-1.5 sm:px-4', isSelf && 'bg-primary/5')}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="flex w-7 shrink-0 flex-col items-center leading-none">
                    <span className="text-base font-bold tabular-nums text-muted-foreground">{e.position}</span>
                    <PositionDelta value={movement?.get(e.userId)} />
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

                {/* Actividad pública del jugador (una línea por reto vivo) */}
                {infoActivities.length > 0 && (
                  <div className="mt-1 space-y-0.5 pl-10">
                    {infoActivities.map((a, i) => (
                      <ActivityLine key={i} a={a} viewerUserId={viewerUserId} />
                    ))}
                  </div>
                )}

                {/* Acción del viewer (Retar / Responder / A jugar) */}
                {showControl && (
                  <div className="mt-1 flex items-center gap-3 pl-10">
                    {e.state === 'none' && e.ifWin != null && e.ifLose != null && (
                      <PointsPair ifWin={e.ifWin} ifLose={e.ifLose} />
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

              <span className="shrink-0 text-base font-bold tabular-nums">{e.rating}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
