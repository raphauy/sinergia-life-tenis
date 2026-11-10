'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { fullName } from '@/lib/format-name'
import { formatMatchScore } from '@/lib/format-score'
import { formatDateUY, formatTimeUY, friendlyDateTimeUY, longDateUY, resultLoadOpen } from '@/lib/date-utils'
import { COURTS, TIMEZONE } from '@/lib/constants'
import { toZonedTime } from 'date-fns-tz'
import { CalendarCheck, Sun, Sunset } from 'lucide-react'
import { AddToCalendarLink } from '@/components/add-to-calendar-link'
import { blobUrl } from '@/lib/blob-url'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HeadToHeadLine } from '@/components/head-to-head-line'
import type { HeadToHead } from '@/services/head-to-head-service'
import type { PublicMatchPairs } from '@/services/doubles-pair-service'
import { isUserInPair, pairShortName } from '@/lib/pair-display'
import { groupName as formatGroupName } from '@/lib/doubles-format'

interface FixtureMatchCardProps {
  match: {
    id: string
    status: string
    stage?: string
    scheduledAt: Date | null
    courtNumber: number | null
    externalCourt?: boolean // escalera autoagendada en cancha ajena al club
    player1: { firstName: string | null; lastName: string | null; email?: string | null } | null
    player2: { firstName: string | null; lastName: string | null; email?: string | null } | null
    player1Id: string | null
    player2Id: string | null
    player1SourceGroup?: { number: number } | null
    player2SourceGroup?: { number: number } | null
    player1SourcePosition?: number | null
    player2SourcePosition?: number | null
    bracketPosition?: number | null
    cup?: 'GOLD' | 'SILVER' | null
    category: { name: string; _count?: { matches: number } } | null
    tournament?: { name: string } | null
    /**
     * Parejas de cada lado en partidos de dobles (lo traen `getUpcomingMatches` y
     * `getMatchesByPlayer`). Con parejas la card muestra "Pareja vs Pareja", linkea a
     * /pareja/[slug] y cuenta como participante a los cuatro. Sin emails: convertir
     * con `toPublicPairs` en el servidor.
     */
    pairs?: PublicMatchPairs | null
    group?: { id: string; number: number } | null
    result: {
      walkover: boolean
      set1Player1: number
      set1Player2: number
      tb1Player1: number | null
      tb1Player2: number | null
      set2Player1: number | null
      set2Player2: number | null
      tb2Player1: number | null
      tb2Player2: number | null
      superTbPlayer1: number | null
      superTbPlayer2: number | null
      winnerId: string
      photoUrl: string | null
    } | null
  }
  player1Slug?: string
  player2Slug?: string
  /** Show date + time instead of only time (default: false, time only) */
  showDate?: boolean
  /** Current logged-in user ID — used to show action links only to participants */
  currentUserId?: string
  /** Current logged-in user's player slug — needed to build action hrefs */
  currentPlayerSlug?: string
  /** Reservation info if the match has a pending reservation */
  reservation?: { scheduledAt: Date; courtNumber: number } | null
  /** Fallback date when no scheduledAt (e.g. finalsDate for semis/final) */
  fallbackDate?: Date | null
  /** Puntos en juego del retador (player1) en partidos de escalera no jugados: +gana / pierde. */
  ladderPreview?: { ifWin: number; ifLose: number } | null
  /** Delta de Rating aplicado a cada jugador (partido de escalera jugado). */
  ladderResultDeltas?: { player1: number | null; player2: number | null } | null
  /** Puesto en La Escalera (#N) de cada jugador; se muestra junto al nombre si viene. */
  player1Rank?: number | null
  player2Rank?: number | null
  /**
   * Historial de escalera entre los dos jugadores (orientado a player1). Si viene, la
   * card muestra la línea "N enfrentamientos · X-Y {líder}" que abre el detalle.
   */
  headToHead?: HeadToHead | null
  /**
   * Dueño del perfil en cuyo contexto se muestra la card: en partidos jugados
   * el badge "Jugado" pasa a "Ganado" (verde) / "Perdido" (rojo) según cómo le
   * fue a él. Sin este prop la card queda neutral (fixture público).
   */
  perspectiveUserId?: string | null
  /**
   * Dobles: invitados al evento "Agendar" (los otros tres), calculados en el servidor
   * con `doublesGuestEmails` solo si el viewer juega el partido.
   */
  guestEmails?: string[]
}

function placeholderSlot(sourceGroupNumber: number | null | undefined, position: number | null | undefined, stage: string | undefined, bracketPosition: number | null | undefined, side: 'player1' | 'player2', qfCount: number, groupName: (n: number) => string = String): string {
  if (sourceGroupNumber != null && position != null) {
    return `${position}° Grupo ${groupName(sourceGroupNumber)}`
  }
  if (stage === 'SEMIFINAL' && bracketPosition != null) {
    // 4 QFs: QF1+QF2→SF1, QF3+QF4→SF2. 2 QFs (3 grupos): QF1→SF1, QF2→SF2.
    const qfNum =
      qfCount === 2
        ? bracketPosition
        : (bracketPosition - 1) * 2 + (side === 'player1' ? 1 : 2)
    return `Ganador QF${qfNum}`
  }
  if (stage === 'FINAL') {
    return side === 'player1' ? 'Ganador Semifinal 1' : 'Ganador Semifinal 2'
  }
  return 'Por definir'
}

function DeltaTag({ d }: { d: number }) {
  return (
    <span
      className={`ml-1 text-xs font-medium tabular-nums ${d >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}
    >
      {d >= 0 ? `+${d}` : d}
    </span>
  )
}

function PlayerName({
  name,
  href,
  isWinner,
  isPlayed,
}: {
  name: string
  href?: string
  isWinner: boolean
  isPlayed: boolean
}) {
  const weight = isPlayed ? (isWinner ? 'font-bold' : 'font-normal') : 'font-semibold'
  if (href) {
    return (
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        className={`${weight} hover:underline`}
      >
        {name}
      </Link>
    )
  }
  return <span className={weight}>{name}</span>
}

export function FixtureMatchCard({ match, player1Slug, player2Slug, showDate = false, currentUserId, currentPlayerSlug, reservation, fallbackDate, ladderPreview, ladderResultDeltas, player1Rank, player2Rank, perspectiveUserId, headToHead, guestEmails: doublesGuests }: FixtureMatchCardProps) {
  const router = useRouter()
  const court = COURTS.find((c) => c.number === match.courtNumber)
  const qfCount = match.category?._count?.matches ?? 4
  // Dobles: cada lado es una pareja (en la base, su representante; ADR 0002).
  const pairs = match.pairs ?? null
  const isDoubles = pairs != null
  const groupName = (n: number) => formatGroupName(n, isDoubles)
  const side1 = pairs?.side1 ?? null
  const side2 = pairs?.side2 ?? null
  const p1Defined = isDoubles ? side1 != null : match.player1 != null
  const p2Defined = isDoubles ? side2 != null : match.player2 != null
  const p1Name = isDoubles && side1
    ? pairShortName(side1)
    : !isDoubles && match.player1
      ? fullName(match.player1.firstName, match.player1.lastName) || 'Jugador 1'
      : placeholderSlot(match.player1SourceGroup?.number, match.player1SourcePosition, match.stage, match.bracketPosition, 'player1', qfCount, groupName)
  const p2Name = isDoubles && side2
    ? pairShortName(side2)
    : !isDoubles && match.player2
      ? fullName(match.player2.firstName, match.player2.lastName) || 'Jugador 2'
      : placeholderSlot(match.player2SourceGroup?.number, match.player2SourcePosition, match.stage, match.bracketPosition, 'player2', qfCount, groupName)
  const p1Href = isDoubles ? (side1 ? `/pareja/${side1.slug}` : undefined) : player1Slug ? `/jugador/${player1Slug}` : undefined
  const p2Href = isDoubles ? (side2 ? `/pareja/${side2.slug}` : undefined) : player2Slug ? `/jugador/${player2Slug}` : undefined
  // Lado del partido en que juega un usuario (en dobles, cualquiera de los dos de la pareja).
  const sideOf = (userId: string | null | undefined): 1 | 2 | null => {
    if (!userId) return null
    if (isDoubles) {
      if (side1 && isUserInPair(side1, userId)) return 1
      if (side2 && isUserInPair(side2, userId)) return 2
      return null
    }
    if (userId === match.player1Id) return 1
    if (userId === match.player2Id) return 2
    return null
  }

  const isPlayed = match.status === 'PLAYED'
  const score = match.result ? formatMatchScore(match.result) : null
  const winnerIs1 = match.result?.winnerId != null && match.result.winnerId === match.player1Id
  const winnerIs2 = match.result?.winnerId != null && match.result.winnerId === match.player2Id
  const hasDateTime = !!match.scheduledAt
  const showFallbackDate = !hasDateTime && !!fallbackDate && (match.stage === 'SEMIFINAL' || match.stage === 'FINAL')
  const matchPassed = match.scheduledAt ? match.scheduledAt.getTime() <= Date.now() : true
  // Confirmado, su horario ya pasó y nadie cargó el resultado. Se muestra como lo que es:
  // "Confirmado" lo hacía parecer por jugarse. La card es compartida, así que el badge sale
  // también en partidos de torneo — ahí es igual de cierto, pero el recordatorio diario por
  // mail solo existe para los de escalera (`remindMissingResults` filtra por ladderId).
  // Exige fecha explícita (`matchPassed` da true sin fecha, para habilitar la carga de
  // resultado): sin esto un confirmado sin horario decía "Falta resultado" acá y
  // "Confirmado" en el panel admin, que resuelve el mismo null al revés.
  const awaitingResult = match.status === 'CONFIRMED' && !match.result && !!match.scheduledAt && matchPassed

  const stageLabel = match.stage && match.stage !== 'GROUP'
    ? (match.stage === 'QUARTERFINAL' ? 'Cuartos de final'
      : match.stage === 'SEMIFINAL' ? `Semifinal${match.bracketPosition ? ' ' + match.bracketPosition : ''}`
      : 'Final') + (match.cup === 'GOLD' ? ' · Oro' : match.cup === 'SILVER' ? ' · Plata' : '')
    : null

  const badgeClass = "text-[10px] px-1.5 py-0 min-w-[72px] text-center justify-center font-bold"
  // Con perspectiva (perfil de un jugador) el "Jugado" se vuelve Ganado/Perdido.
  const perspectiveSide = sideOf(perspectiveUserId)
  const hasPerspective = perspectiveSide != null && match.result != null
  const perspectiveWon = hasPerspective && (perspectiveSide === 1 ? winnerIs1 : winnerIs2)
  const statusBadge = match.status === 'PLAYED'
    ? hasPerspective
      ? perspectiveWon
        ? <Badge variant="success" className={badgeClass}>Ganado</Badge>
        : <Badge variant="destructive" className={`${badgeClass} border-destructive/30 dark:border-destructive/40`}>Perdido</Badge>
      : <Badge variant="success" className={badgeClass}>Jugado</Badge>
    : awaitingResult
      ? <Badge variant="warning" className={badgeClass}>Falta resultado</Badge>
      : match.status === 'CONFIRMED'
        ? <Badge variant="default" className={badgeClass}>Confirmado</Badge>
        : <Badge variant="warning" className={badgeClass}>Pendiente</Badge>

  function getDateTimeLabel() {
    if (!hasDateTime) return null
    if (match.status === 'PLAYED') return `${formatDateUY(match.scheduledAt!, 'dd/MM')} ${formatTimeUY(match.scheduledAt!)} hs`
    if (!showDate) return `${formatTimeUY(match.scheduledAt!)} hs`
    return friendlyDateTimeUY(match.scheduledAt!)
  }

  const dateTimeLabel = getDateTimeLabel()

  // Show action link only to participants of this match
  const viewerSide = currentPlayerSlug ? sideOf(currentUserId) : null
  const isParticipant = viewerSide != null
  const matchHref = isParticipant ? `/jugador/${currentPlayerSlug}/partidos/${match.id}` : null

  const actionLink = !isParticipant || !matchHref ? null
    : match.status === 'PENDING' ? (isDoubles ? null : (
      <Link href={matchHref} onClick={(e) => e.stopPropagation()} className="text-xs font-medium text-primary hover:underline">
        Coordinar con tu rival →
      </Link>
    )) : match.status === 'CONFIRMED' && !match.result ? (
      resultLoadOpen(match.scheduledAt, isDoubles) ? (
        <Link href={matchHref} onClick={(e) => e.stopPropagation()} className="text-xs font-medium text-primary hover:underline">
          Cargar resultado →
        </Link>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<span className="text-xs font-medium text-muted-foreground/50 cursor-not-allowed" onClick={(e) => e.stopPropagation()} />}>
              Cargar resultado →
            </TooltipTrigger>
            <TooltipContent>Disponible después del partido</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    ) : null

  // Link "Agendar" (Google Calendar) en todo partido confirmado sin resultado, con
  // fecha/hora y todavía por jugarse: público. Si el horario ya pasó no se ofrece —
  // agendar un partido de la semana pasada no tiene sentido, ahí lo que falta es el
  // resultado. El título depende del viewer: participante → "Tenis vs {su rival}",
  // espectador → "{p1} vs {p2}". El court va en la ubicación del evento.
  // Invitar al rival solo si el viewer es participante (un espectador no debe invitar a
  // los jugadores). El rival es el otro jugador del partido.
  // En dobles los invitados (los otros tres) vienen calculados del servidor.
  const guestEmails = !isParticipant
    ? []
    : isDoubles
      ? doublesGuests ?? []
      : [(viewerSide === 1 ? match.player2?.email : match.player1?.email) ?? null].filter((e): e is string => !!e)
  const calendarLink = match.status === 'CONFIRMED' && !match.result && match.scheduledAt && !matchPassed ? (
    <span onClick={(e) => e.stopPropagation()}>
      <AddToCalendarLink
        start={match.scheduledAt}
        title={
          isParticipant
            ? `Tenis vs ${viewerSide === 1 ? p2Name : p1Name}`
            : `${p1Name} vs ${p2Name}`
        }
        location={match.externalCourt ? undefined : court ? `Life Montevideo · ${court.name}` : 'Life Montevideo'}
        guestEmails={guestEmails.length > 0 ? guestEmails : undefined}
      />
    </span>
  ) : null

  // Los popups de la card (Dialog del historial, Tooltip) se renderizan en un portal,
  // pero React propaga el evento por SU árbol: sin este filtro, un tap adentro del
  // Dialog (o en el backdrop) dispararía la navegación de la card.
  const fromCard = (e: React.SyntheticEvent) => e.currentTarget.contains(e.target as Node)

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={(e) => { if (fromCard(e)) router.push(`/partido/${match.id}`) }}
      onKeyDown={(e) => { if (e.key === 'Enter' && fromCard(e)) router.push(`/partido/${match.id}`) }}
      className="rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
    >
      {/* Row 1: Player1 vs Player2 + morning/afternoon icon */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="flex min-w-0 flex-1 items-center gap-1">
            <span className="min-w-0 truncate">
              <PlayerName name={p1Name} href={p1Defined ? p1Href : undefined} isWinner={winnerIs1} isPlayed={isPlayed} />
            </span>
            {p1Defined && player1Rank != null && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">#{player1Rank}</span>
            )}
            {ladderResultDeltas?.player1 != null && <span className="shrink-0"><DeltaTag d={ladderResultDeltas.player1} /></span>}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">vs</span>
          <span className="flex min-w-0 flex-1 items-center gap-1">
            <span className="min-w-0 truncate">
              <PlayerName name={p2Name} href={p2Defined ? p2Href : undefined} isWinner={winnerIs2} isPlayed={isPlayed} />
            </span>
            {p2Defined && player2Rank != null && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">#{player2Rank}</span>
            )}
            {ladderResultDeltas?.player2 != null && <span className="shrink-0"><DeltaTag d={ladderResultDeltas.player2} /></span>}
          </span>
        </div>
        {match.result?.photoUrl
          ? <img src={blobUrl(match.result.photoUrl)} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
          : hasDateTime && (
            toZonedTime(match.scheduledAt!, TIMEZONE).getHours() < 12
              ? <Sun className="h-4 w-4 text-yellow-500 shrink-0" />
              : <Sunset className="h-4 w-4 text-indigo-400 shrink-0" />
          )}
      </div>

      {/* Row 2: Category - Group/Stage (+ badge if no date/time) */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        {match.category ? (
          <span>
            {isDoubles ? match.tournament?.name ?? 'Dobles' : `Categoría ${match.category.name}`}
            {stageLabel ? ` - ${stageLabel}` : match.group ? ` - Grupo ${groupName(match.group.number)}` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            {match.player1 && <span>Retador: {p1Name}</span>}
            {ladderPreview && !isPlayed && (
              <span className="tabular-nums">
                <span className="font-medium text-green-600 dark:text-green-500">+{ladderPreview.ifWin}</span>
                <span className="text-muted-foreground/50">/</span>
                <span className="font-medium text-red-600 dark:text-red-500">{ladderPreview.ifLose}</span>
              </span>
            )}
          </span>
        )}
        {!hasDateTime && !showFallbackDate && statusBadge}
      </div>

      {/* Row 3: Date/Time - Court + badge (only if has date/time) */}
      {hasDateTime && (
        <div className="mt-0.5 flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="min-w-0 truncate">
            <span className="font-bold text-foreground">{dateTimeLabel}</span>
            {match.externalCourt ? ' - Fuera del club' : court && ` - ${court.name}`}
          </span>
          {!isPlayed && statusBadge}
        </div>
      )}

      {/* Row 3 (fallback): only date (e.g. finalsDate for SF/F without time) */}
      {!hasDateTime && showFallbackDate && fallbackDate && (
        <div className="mt-0.5 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            <span className="font-bold text-foreground">{longDateUY(fallbackDate)}</span>
          </span>
          {statusBadge}
        </div>
      )}

      {/* Row 4: Score + Winner + badge (only if played) */}
      {isPlayed && score && (
        <div className="mt-0.5 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">{score}</span>
            {match.result && (
              <span>Ganador: {winnerIs1 ? p1Name : p2Name}</span>
            )}
          </div>
          {statusBadge}
        </div>
      )}

      {/* Reservation info */}
      {reservation && match.status === 'PENDING' && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
          <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
          <span>
            Reservado {showDate ? friendlyDateTimeUY(reservation.scheduledAt) : `${formatTimeUY(reservation.scheduledAt)} hs`}          </span>
        </div>
      )}

      {/* Historial entre ambos (escalera): línea clickeable → Dialog con los cruces */}
      {headToHead && p1Defined && p2Defined && (
        <HeadToHeadLine
          h2h={headToHead}
          player1={{ name: p1Name, slug: player1Slug }}
          player2={{ name: p2Name, slug: player2Slug }}
        />
      )}

      {/* Action links: agendar (participante, confirmado) + cargar resultado / coordinar */}
      {(calendarLink || actionLink) && (
        <div className="flex justify-center items-center gap-4 mt-2 pt-2 border-t border-border/50">
          {calendarLink}
          {actionLink}
        </div>
      )}
    </div>
  )
}
