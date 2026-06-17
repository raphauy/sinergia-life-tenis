import Link from 'next/link'
import { IconTooltip } from '@/components/icon-tooltip'
import { AddToCalendarLink } from '@/components/add-to-calendar-link'
import { friendlyDateTimeUY } from '@/lib/date-utils'
import { COURTS } from '@/lib/constants'
import type { LadderActivity } from '@/services/challenge-service'

/**
 * Puntos en juego: +gana / pierde (ifLose ya viene negativo). Tooltip (shadcn) apto mobile.
 * Con `subjectName` el tooltip es en 3ra persona ("{nombre} gana X, pierde Y") — para los
 * puntos del dueño de otra fila; sin él, 2da persona ("Ganás…") — para el preview del viewer.
 */
export function PointsPair({ ifWin, ifLose, subjectName }: { ifWin: number; ifLose: number; subjectName?: string | null }) {
  const label = subjectName
    ? `${subjectName} gana ${ifWin}, pierde ${Math.abs(ifLose)}`
    : `Ganás ${ifWin}, perdés ${Math.abs(ifLose)}`
  return (
    <IconTooltip label={label}>
      <span className="inline-flex items-center gap-1 text-xs">
        <span className="font-semibold text-green-600 tabular-nums dark:text-green-500">+{ifWin}</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="font-semibold text-red-600 tabular-nums dark:text-red-500">{ifLose}</span>
      </span>
    </IconTooltip>
  )
}

/**
 * Una línea de actividad de reto/partido, desde la perspectiva del dueño de la fila/perfil.
 * `ownerName`: nombre del dueño para el tooltip de puntos (3ra persona). Null/omitido cuando
 * el dueño es el propio viewer (su fila), donde corresponde 2da persona ("Ganás…").
 */
export function ActivityLine({ a, viewerUserId, ownerName, isSelf, rowOwnerName }: { a: LadderActivity; viewerUserId?: string | null; ownerName?: string | null; isSelf?: boolean; rowOwnerName?: string }) {
  const isViewer = !!viewerUserId && a.rivalUserId === viewerUserId

  // Link "Agendar" (Google Calendar) en cualquier partido confirmado: público. El
  // tratamiento "tu partido" (título "Tenis vs {rival}" + invitar al rival al evento)
  // es solo en tu propia fila; en las demás, título neutro "{dueño} vs {rival}" sin
  // invitados (un espectador no debe invitar a los jugadores). El court va en la ubicación.
  const showCalendar = a.kind === 'playing' && !!a.scheduledAt
  const calendarTitle = isSelf
    ? `Tenis vs ${a.rivalName}`
    : `${rowOwnerName ?? ''} vs ${a.rivalName}`
  const calendarGuests = isSelf && a.rivalEmail ? [a.rivalEmail] : undefined
  const courtName = COURTS.find((c) => c.number === a.courtNumber)?.name

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
          <PointsPair ifWin={a.ifWin} ifLose={a.ifLose} subjectName={ownerName} />
        </span>
      </div>
      {condition && (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-4 text-muted-foreground/80">
          <span>{condition}</span>
          {showCalendar && (
            <AddToCalendarLink
              start={a.scheduledAt!}
              title={calendarTitle}
              location={courtName ? `Life Montevideo · ${courtName}` : 'Life Montevideo'}
              guestEmails={calendarGuests}
            />
          )}
        </div>
      )}
    </div>
  )
}
