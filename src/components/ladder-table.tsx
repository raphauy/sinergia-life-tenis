import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChallengeControl } from '@/components/challenge-control'
import { PositionDelta } from '@/components/position-delta'
import { ActivityLine, PointsPair } from '@/components/ladder-activity-line'
import { IconTooltip } from '@/components/icon-tooltip'
import { WinStreakBadge } from '@/components/win-streak-badge'
import { MonthlyMatchesBadge } from '@/components/monthly-matches-badge'
import { RatingMonthDelta } from '@/components/rating-month-delta'
import { ProtectionBadge } from '@/components/protection-badge'
import { PlayerChartDialog } from '@/components/player-chart-dialog'
import { cn } from '@/lib/utils'
import type { LadderRow } from '@/services/challenge-service'
import type { MonthlyMatchDetail, RatingPoint } from '@/services/ladder-stats-service'

interface Props {
  rows: LadderRow[]
  canChallenge?: boolean
  currentPlayerSlug?: string | null
  /** userId del viewer logueado: para no duplicar su propio reto (ya lo cubre el control). */
  viewerUserId?: string | null
  /** Movimiento de puesto del mes por userId (↑/↓). */
  movement?: Map<string, number>
  /** userId del jugador de la semana en curso: muestra la copita al lado del nombre. */
  playerOfWeekUserId?: string | null
  /** Racha de victorias consecutivas por userId: muestra fueguitos al lado del nombre. */
  winStreaks?: Map<string, number>
  /** Partidos jugados en el mes corriente por userId: muestra pelotitas abajo a la derecha. */
  monthlyMatches?: Map<string, MonthlyMatchDetail[]>
  /** Variación neta de puntos del mes por userId: flecha ↑/↓ al lado del puntaje. */
  monthDeltas?: Map<string, number>
  /** Curva de evolución de puntos por userId: al tocar el puntaje abre un Dialog con la gráfica. */
  evolutions?: Map<string, RatingPoint[]>
}

export function LadderTable({ rows, canChallenge, currentPlayerSlug, viewerUserId, movement, playerOfWeekUserId, winStreaks, monthlyMatches, monthDeltas, evolutions }: Props) {
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
          const isPlayerOfWeek = e.userId === playerOfWeekUserId
          const streak = winStreaks?.get(e.userId) ?? 0
          const monthly = monthlyMatches?.get(e.userId) ?? []
          const evo = evolutions?.get(e.userId) ?? []
          const isProtected = !!e.protection
          // El control (acción del viewer) solo para estados accionables; 'sent' no
          // lleva control (el "Retó a X" ya aparece en la fila propia del viewer).
          // Un protegido no es retable: sin control.
          const showControl =
            !!canChallenge && !isSelf && !isProtected &&
            (e.state === 'none' || e.state === 'received' || e.state === 'playing')
          // Mostrar toda la actividad del jugador (incluido el reto que involucra al
          // propio viewer, con etiqueta "ti"), igual que en la vista pública. El
          // control aporta la acción; la línea, el contexto.
          const infoActivities = e.activities

          return (
            <div
              key={e.userId}
              className={cn(
                'relative flex items-center gap-3 px-3 py-1.5 sm:px-4',
                isSelf && 'bg-primary/5',
                // Con pelotita: el alto reserva el lugar del fueguito (arriba) y de la
                // pelotita (abajo) aunque no haya fueguito, para que avatar/nombre/puntos
                // queden siempre centrados verticalmente entre ambas zonas, con margen
                // entre los puntos y la pelotita.
                monthly.length >= 1 && 'min-h-[5.5rem]'
              )}
            >
              {/* Fueguito / trofeo arriba a la derecha. Su lugar queda reservado por el
                  alto mínimo de la fila aunque no haya fueguito (puntos centrados). */}
              {(isPlayerOfWeek || streak >= 1) && (
                <div className="absolute right-3 top-1 flex items-center gap-3 sm:right-4">
                  {isPlayerOfWeek && (
                    <IconTooltip label="Jugador de la semana">
                      <Trophy className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                    </IconTooltip>
                  )}
                  <WinStreakBadge streak={streak} />
                </div>
              )}
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
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {e.playerSlug ? (
                      <Link href={`/jugador/${e.playerSlug}`} className="min-w-0 truncate font-medium hover:underline">
                        {e.name}
                      </Link>
                    ) : (
                      <span className="min-w-0 truncate font-medium">{e.name}</span>
                    )}
                  </span>
                  {isSelf && (
                    <span className="shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      tu puesto
                    </span>
                  )}
                </div>

                {/* Actividad pública del jugador (una línea por reto vivo) */}
                {infoActivities.length > 0 && (
                  <div className="mt-1 space-y-1.5 pl-10">
                    {infoActivities.map((a, i) => (
                      <ActivityLine key={i} a={a} viewerUserId={viewerUserId} ownerName={isSelf ? null : e.name} />
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

              {isProtected && <ProtectionBadge protection={e.protection} className="shrink-0" />}
              <span className="flex shrink-0 items-center gap-2">
                <RatingMonthDelta value={monthDeltas?.get(e.userId)} />
                {evo.length >= 2 ? (
                  <PlayerChartDialog playerName={e.name} points={evo} className="text-base font-bold tabular-nums">
                    {e.rating}
                  </PlayerChartDialog>
                ) : (
                  <span className="text-base font-bold tabular-nums">{e.rating}</span>
                )}
              </span>
              {/* Pelotita abajo a la derecha. Su lugar queda reservado por el alto. */}
              {monthly.length >= 1 && (
                <div className="absolute bottom-1 right-3 sm:right-4">
                  <MonthlyMatchesBadge matches={monthly} playerName={e.name} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
