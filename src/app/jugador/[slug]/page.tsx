import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { SITE_URL } from '@/lib/site-url'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { blobUrl } from '@/lib/blob-url'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FixtureMatchCard } from '@/components/fixture-match-card'
import { getUpcomingMatches, getMatchesByPlayer } from '@/services/match-service'
import { getReservationsByMatchIds } from '@/services/reservation-service'
import { getInbox, getChallengeState, getMemberChallenges } from '@/services/challenge-service'
import { getMonthlyActivity, getLadderRanking } from '@/services/ladder-service'
import {
  getMemberStanding,
  getWeeklyPositionMovement,
  getRatingEvolution,
  getPlayerOfTheWeek,
  getLadderChallengerPreviews,
  getLadderResultDeltas,
  getLadderWinStreak,
} from '@/services/ladder-stats-service'
import { getActivePlayerSlugByUserId } from '@/services/player-service'
import { ChallengeControl } from '@/components/challenge-control'
import { ChallengeInbox } from '@/components/challenge-inbox'
import { LadderMonthlyStatus } from '@/components/ladder-monthly-status'
import { PositionDelta } from '@/components/position-delta'
import { RatingEvolutionChart } from '@/components/rating-evolution-chart'
import { PublicChallenges } from '@/components/public-challenges'
import { fullName, initials } from '@/lib/format-name'
import { formatDateUY } from '@/lib/date-utils'
import { PROTECTION_META } from '@/components/protection-meta'
import { Flame, Trophy } from 'lucide-react'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const player = await prisma.player.findUnique({
    where: { slug },
    include: {
      user: { select: { firstName: true, lastName: true, image: true } },
    },
  })

  if (!player) return { title: 'Jugador no encontrado' }

  const name = player.user
    ? fullName(player.user.firstName, player.user.lastName)
    : fullName(player.firstName, player.lastName)
  const standing = player.userId ? await getMemberStanding(player.userId) : null

  const title = `${name} - Life Tenis`
  const description = standing
    ? `${name} en La Escalera de Life Montevideo — ${standing.rating} puntos, puesto #${standing.position}.`
    : `Perfil de ${name} en La Escalera de Life Montevideo.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      ...(player.user?.image ? { images: [{ url: `${SITE_URL}/api/blob?url=${encodeURIComponent(player.user.image)}` }] } : {}),
    },
  }
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function JugadorProfilePage({ params }: Props) {
  const { slug } = await params

  const player = await prisma.player.findUnique({
    where: { slug },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, image: true } },
    },
  })

  if (!player) notFound()

  const session = await auth()
  const isOwner = session?.user?.id === player.userId
  const isAdmin = session?.user?.role === 'SUPERADMIN' || session?.user?.role === 'ADMIN'
  const canAct = isOwner || isAdmin

  const displayName = fullName(player.user?.firstName ?? player.firstName, player.user?.lastName ?? player.lastName)
  const image = blobUrl(player.user?.image)
  const userId = player.userId

  // Fetch matches if player has a linked user
  const upcomingRaw = userId ? await getUpcomingMatches(userId) : []
  const allMatches = userId ? await getMatchesByPlayer(userId) : []
  const recentPlayed = allMatches.filter((m) => m.status === 'PLAYED').slice(0, 5)

  // Sort upcoming: confirmed first, then by date
  const upcoming = [...upcomingRaw].sort((a, b) => {
    const order = { CONFIRMED: 0, PENDING: 1 } as const
    const oa = order[a.status as keyof typeof order] ?? 1
    const ob = order[b.status as keyof typeof order] ?? 1
    if (oa !== ob) return oa - ob
    if (!a.scheduledAt) return 1
    if (!b.scheduledAt) return -1
    return a.scheduledAt.getTime() - b.scheduledAt.getTime()
  })

  // Build userId -> playerSlug map for linking
  const allUserIds = new Set<string>()
  for (const m of [...upcoming, ...recentPlayed]) {
    if (m.player1Id) allUserIds.add(m.player1Id)
    if (m.player2Id) allUserIds.add(m.player2Id)
  }
  const playerLinks = await prisma.player.findMany({
    where: { userId: { in: [...allUserIds] }, isActive: true },
    select: { slug: true, userId: true },
  })
  const playerMap = new Map(playerLinks.map((p) => [p.userId!, p.slug]))

  const pendingIds = upcoming.filter((m) => m.status === 'PENDING').map((m) => m.id)
  const reservations = await getReservationsByMatchIds(pendingIds)
  const reservationMap = new Map(reservations.map((r) => [r.matchId, { scheduledAt: r.scheduledAt, courtNumber: r.courtNumber }]))

  // Puntos en juego del retador para los próximos partidos de escalera (cards).
  const ladderPreviews = await getLadderChallengerPreviews(upcoming)
  // Deltas aplicados en los partidos de escalera ya jugados (historial).
  const resultDeltas = await getLadderResultDeltas(recentPlayed)

  // La Escalera: estado del reto entre el viewer y este perfil (+ preview); bandeja del dueño.
  const viewerId = session?.user?.id ?? null
  const challengeState = viewerId && userId ? await getChallengeState(viewerId, userId) : null
  const inbox = isOwner && userId ? await getInbox(userId) : null
  // Estado de actividad mensual: solo para el dueño/admin y si es miembro de la escalera.
  const monthlyActivity = canAct && userId ? await getMonthlyActivity(userId) : null

  // Gamificación (pública): rating+puesto, movimiento de la semana, evolución, jugador de la semana.
  const [standing, ratingEvolution, playerOfWeek, movement, ranking, winStreak] = userId
    ? await Promise.all([
        getMemberStanding(userId),
        getRatingEvolution(userId),
        getPlayerOfTheWeek(),
        getWeeklyPositionMovement(),
        getLadderRanking(),
        getLadderWinStreak(userId),
      ])
    : [null, [], null, new Map<string, number>(), [], 0]
  const isPlayerOfWeek = !!playerOfWeek && playerOfWeek.userId === userId
  // Ranking protegido vigente (lesión/viaje/otro): badge público en el header.
  const myProtection = userId ? ranking.find((e) => e.userId === userId)?.protection ?? null : null
  const protectionMeta = myProtection ? PROTECTION_META[myProtection.reason] : null
  // Puesto en La Escalera (#N) por usuario; solo se muestra en partidos de escalera.
  const positionByUser = new Map(ranking.map((e) => [e.userId, e.position]))
  const rankFor = (m: { ladderId: string | null }, playerId: string | null) =>
    m.ladderId && playerId ? positionByUser.get(playerId) ?? null : null
  // Retos del jugador para la vista pública (read-only). No para el dueño (los ve
  // con acciones en su bandeja). El reto con el propio viewer se muestra con
  // etiqueta personalizada ("Retado por ti" / "Te retó").
  const publicChallenges = userId && !isOwner ? await getMemberChallenges(userId) : []
  // Slug del viewer para los links de "Responder" / "A jugar" del control.
  const viewerPanelSlug =
    viewerId && challengeState && (challengeState.state === 'received' || challengeState.state === 'playing')
      ? await getActivePlayerSlugByUserId(viewerId)
      : null

  return (
    <div>
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-8">
        <Avatar className="h-20 w-20">
          <AvatarImage src={image || undefined} />
          <AvatarFallback className="text-2xl">
            {initials(player.user?.firstName ?? player.firstName, player.user?.lastName ?? player.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{displayName}</h1>
          {standing && (
            <div className="mt-2 space-y-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-semibold tabular-nums">Ranking #{standing.position}</span>
                <PositionDelta value={userId ? movement.get(userId) : undefined} />
                {isPlayerOfWeek && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    <Trophy className="h-3 w-3" /> Jugador de la semana
                  </span>
                )}
                {winStreak >= 1 && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                    <Flame className="h-3 w-3 fill-red-500/25" /> Racha de {winStreak} {winStreak === 1 ? 'victoria' : 'victorias'}
                  </span>
                )}
                {myProtection && protectionMeta && (
                  <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${protectionMeta.pill}`}>
                    <protectionMeta.Icon className="h-3 w-3" /> Protegido · {protectionMeta.label}
                    {myProtection.endDate ? ` hasta ${formatDateUY(myProtection.endDate)}` : ''}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="tabular-nums">{standing.rating}</span> puntos en La Escalera
              </p>
            </div>
          )}
        </div>
        {challengeState && challengeState.state !== 'self' && userId && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <ChallengeControl
              state={challengeState.state}
              rivalUserId={userId}
              rivalName={displayName}
              preview={challengeState.preview}
              matchId={challengeState.matchId}
              panelHref={viewerPanelSlug ? `/jugador/${viewerPanelSlug}` : '/'}
              size="default"
            />
            {challengeState.state === 'none' && challengeState.preview && (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-green-600 tabular-nums dark:text-green-500">+{challengeState.preview.ifWin}</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="font-semibold text-red-600 tabular-nums dark:text-red-500">{challengeState.preview.ifLose}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Estado de actividad mensual (solo dueño/admin, si es miembro) */}
      {monthlyActivity && <LadderMonthlyStatus activity={monthlyActivity} />}

      {/* Bandeja de retos (solo el dueño, con acciones) */}
      {inbox && <ChallengeInbox received={inbox.received} sent={inbox.sent} />}

      {/* Retos del jugador (vista pública, read-only) — para quien no es el dueño */}
      {publicChallenges.length > 0 && <PublicChallenges challenges={publicChallenges} viewerUserId={viewerId} />}

      {/* Evolución de rating (pública, si es miembro con historial) */}
      {ratingEvolution.length >= 2 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Evolución</h2>
          <RatingEvolutionChart points={ratingEvolution} />
        </section>
      )}

      {/* Upcoming matches */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Próximos partidos</h2>
          {userId && (
            <Button variant="ghost" size="sm" render={<Link href={`/jugador/${slug}/partidos`} />}>
              Ver todos
            </Button>
          )}
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay partidos próximos.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((m) => (
              <FixtureMatchCard
                key={m.id}
                match={m}
                showDate
                player1Slug={m.player1Id ? playerMap.get(m.player1Id) : undefined}
                player2Slug={m.player2Id ? playerMap.get(m.player2Id) : undefined}
                player1Rank={rankFor(m, m.player1Id)}
                player2Rank={rankFor(m, m.player2Id)}
                currentUserId={canAct ? userId ?? undefined : undefined}
                currentPlayerSlug={canAct ? slug : undefined}
                reservation={reservationMap.get(m.id)}
                ladderPreview={ladderPreviews.get(m.id) ?? null}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent history */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Historial reciente</h2>
        {recentPlayed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay partidos jugados.</p>
        ) : (
          <div className="space-y-2">
            {recentPlayed.map((m) => (
              <FixtureMatchCard
                key={m.id}
                match={m}
                showDate
                player1Slug={m.player1Id ? playerMap.get(m.player1Id) : undefined}
                player2Slug={m.player2Id ? playerMap.get(m.player2Id) : undefined}
                player1Rank={rankFor(m, m.player1Id)}
                player2Rank={rankFor(m, m.player2Id)}
                ladderResultDeltas={resultDeltas.get(m.id) ?? null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
