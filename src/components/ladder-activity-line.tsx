import Link from 'next/link'
import { IconTooltip } from '@/components/icon-tooltip'
import { friendlyDateTimeUY } from '@/lib/date-utils'
import type { LadderActivity } from '@/services/challenge-service'

/** Puntos en juego: +gana / pierde (ifLose ya viene negativo). Tooltip (shadcn) apto mobile. */
export function PointsPair({ ifWin, ifLose }: { ifWin: number; ifLose: number }) {
  return (
    <IconTooltip label={`Ganás ${ifWin}, perdés ${Math.abs(ifLose)}`}>
      <span className="inline-flex items-center gap-1 text-xs">
        <span className="font-semibold text-green-600 tabular-nums dark:text-green-500">+{ifWin}</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="font-semibold text-red-600 tabular-nums dark:text-red-500">{ifLose}</span>
      </span>
    </IconTooltip>
  )
}

/** Una línea de actividad de reto/partido, desde la perspectiva del dueño de la fila/perfil. */
export function ActivityLine({ a, viewerUserId }: { a: LadderActivity; viewerUserId?: string | null }) {
  const isViewer = !!viewerUserId && a.rivalUserId === viewerUserId

  // Condición del encuentro (solo partidos a jugar): fecha/hora si está confirmado,
  // "reservado" si hay reserva pedida, "a coordinar" si falta agendar. Los retos no llevan.
  const condition =
    a.kind === 'playing'
      ? a.scheduledAt
        ? friendlyDateTimeUY(a.scheduledAt)
        : a.reserved
          ? 'reservado'
          : 'a coordinar'
      : null

  // Cuando el rival del reto es el propio viewer, personalizamos en 2da persona
  // (el rival ES el viewer, así que no se enlaza el nombre).
  const subject = isViewer ? (
    <span>{a.kind === 'sent' ? 'Te retó' : a.kind === 'received' ? 'Retado por ti' : 'Tu partido'}</span>
  ) : (
    <span>
      {a.kind === 'sent' ? 'Retó a' : a.kind === 'received' ? 'Retado por' : 'vs'}{' '}
      {a.rivalSlug ? (
        <Link href={`/jugador/${a.rivalSlug}`} className="font-medium hover:underline">
          {a.rivalName}
        </Link>
      ) : (
        <span className="font-medium">{a.rivalName}</span>
      )}{' '}
      <span className="text-muted-foreground/70">#{a.rivalPosition}</span>
    </span>
  )

  // Línea 1: "vs Player #N" + puntos (separados, no pegados a la derecha).
  // Línea 2 (solo si hay condición): la condición, indentada para alinear con el nombre.
  return (
    <div className="text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate">{subject}</span>
        <span className="shrink-0">
          <PointsPair ifWin={a.ifWin} ifLose={a.ifLose} />
        </span>
      </div>
      {condition && <div className="mt-0.5 pl-4 text-muted-foreground/80">{condition}</div>}
    </div>
  )
}
