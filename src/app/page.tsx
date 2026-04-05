import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getActiveTournament } from '@/services/tournament-service'
import { getRankingByCategory, getRankingByGroup } from '@/services/ranking-service'
import { getMatches, getTodayMatches } from '@/services/match-service'
import { getGroupsByCategory } from '@/services/group-service'
import { getActivePlayerSlugByUserId, getPlayerMapByCategory } from '@/services/player-service'
import { RankingTable } from '@/components/ranking-table'
import { FixtureMatchCard } from '@/components/fixture-match-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, Calendar, FileText, ChevronRight, Clock } from 'lucide-react'
import { PublicNav } from '@/components/public-nav'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { TodayMatchCard } from '@/components/today-match-card'
import { getReservationsByMatchIds } from '@/services/reservation-service'

export async function generateMetadata(): Promise<Metadata> {
  const tournament = await getActiveTournament()
  const title = tournament
    ? `${tournament.name} - Life Tenis`
    : 'Life Tenis - Club Sinergia Life'
  const description = tournament
    ? `Ranking, fixture y resultados del ${tournament.name} - Club Sinergia Life`
    : 'Torneos de tenis del Club Sinergia Life'

  return { title, description }
}

export default async function HomePage() {
  const session = await auth()
  const tournament = await getActiveTournament()

  // Determine where to link the logged-in user + resolve player slug for actions
  let userHref: string | null = null
  let currentPlayerSlug: string | null = null
  if (session?.user) {
    currentPlayerSlug = await getActivePlayerSlugByUserId(session.user.id)
    if (session.user.role === 'SUPERADMIN' || session.user.role === 'ADMIN') {
      userHref = '/admin'
    } else {
      userHref = currentPlayerSlug ? `/jugador/${currentPlayerSlug}` : '/perfil'
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="border-b bg-white dark:bg-black sticky top-0 z-50">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/">
            <Image src="/life-logo.png" alt="Life Tenis" width={120} height={40} className="block dark:hidden" />
            <Image src="/life-logo-dark.png" alt="Life Tenis" width={120} height={40} className="hidden dark:block" />
          </Link>
          <PublicNav userHref={userHref} />
        </div>
      </header>

      {/* Hero */}
      <section className="relative h-64 md:h-80 overflow-hidden">
        <Image
          src="/hero-cancha.png"
          alt="Cancha de tenis Sinergia Life"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Life Tenis</h1>
          {tournament ? (
            <p className="text-lg md:text-xl opacity-90">{tournament.name}</p>
          ) : (
            <p className="text-lg opacity-75">Torneos de tenis</p>
          )}
        </div>
      </section>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {!tournament ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No hay torneo activo en este momento.</p>
          </div>
        ) : (
          <TournamentContent tournament={tournament} currentUserId={session?.user?.id} currentPlayerSlug={currentPlayerSlug ?? undefined} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Life Tenis</span>
          <div className="flex gap-4">
            <Link href="/ranking" className="hover:text-foreground">Ranking</Link>
            <Link href="/fixture" className="hover:text-foreground">Fixture</Link>
            <Link href="/calendario" className="hover:text-foreground">Calendario</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

async function TournamentContent({
  tournament,
  currentUserId,
  currentPlayerSlug,
}: {
  tournament: NonNullable<Awaited<ReturnType<typeof getActiveTournament>>>
  currentUserId?: string
  currentPlayerSlug?: string
}) {
  const categories = tournament.categories

  if (categories.length === 0) {
    return <p className="text-muted-foreground">No hay categorías configuradas.</p>
  }

  // Fetch today's matches + ranking + matches + groups for all categories
  const [todayMatches, ...data] = await Promise.all([
    getTodayMatches(tournament.id),
    ...categories.map(async (cat) => {
      const [ranking, matches, playerMap, groups] = await Promise.all([
        getRankingByCategory(cat.id),
        getMatches({ categoryId: cat.id }),
        getPlayerMapByCategory(cat.id),
        getGroupsByCategory(cat.id),
      ])

      const groupRankings = await Promise.all(
        groups.map(async (g) => ({
          group: g,
          ranking: await getRankingByGroup(g.id),
        }))
      )

      const upcoming = matches.filter((m) => m.status === 'PENDING' || m.status === 'CONFIRMED')
      const played = matches.filter((m) => m.status === 'PLAYED')
      const confirmed = matches
        .filter((m) => m.status === 'CONFIRMED')
        .sort((a, b) => {
          if (!a.scheduledAt) return 1
          if (!b.scheduledAt) return -1
          return a.scheduledAt.getTime() - b.scheduledAt.getTime()
        })

      const pendingCount = matches.filter((m) => m.status === 'PENDING').length
      const confirmedCount = confirmed.length
      const playedCount = played.length
      const totalCount = pendingCount + confirmedCount + playedCount

      return { cat, ranking, upcoming, played, confirmed, playerMap, groups, groupRankings, pendingCount, confirmedCount, playedCount, totalCount }
    }),
  ])

  const defaultTab = categories[0].id

  // Fetch reservations for all pending matches
  const allPendingIds = data.flatMap(({ upcoming }) =>
    upcoming.filter((m) => m.status === 'PENDING').map((m) => m.id)
  )
  const reservations = await getReservationsByMatchIds(allPendingIds)
  const reservationMap = new Map(reservations.map((r) => [r.matchId, { scheduledAt: r.scheduledAt, courtNumber: r.courtNumber }]))

  // Merge all player maps for today's matches
  const allPlayerSlugs = new Map<string, string>()
  for (const { playerMap } of data) {
    for (const [userId, slug] of playerMap) {
      allPlayerSlugs.set(userId, slug)
    }
  }

  return (
    <>
    {/* Partidos de hoy */}
    {todayMatches.length > 0 && (
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Partidos de hoy ({todayMatches.length})</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {todayMatches.map((m) => (
            <TodayMatchCard
              key={m.id}
              match={m}
              player1Slug={allPlayerSlugs.get(m.player1Id)}
              player2Slug={allPlayerSlugs.get(m.player2Id)}
              currentUserId={currentUserId}
              currentPlayerSlug={currentPlayerSlug}
            />
          ))}
        </div>
      </section>
    )}

    <Tabs defaultValue={defaultTab}>
      <TabsList className="mb-6 w-full h-11 bg-orange-100 dark:bg-orange-950">
        {categories.map((cat) => (
          <TabsTrigger key={cat.id} value={cat.id} className="font-semibold cursor-pointer">
            Categoría {cat.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {data.map(({ cat, ranking, upcoming, played, confirmed, playerMap, groups, groupRankings, pendingCount, confirmedCount, playedCount, totalCount }) => (
        <TabsContent key={cat.id} value={cat.id}>
          {/* Resumen de partidos */}
          {totalCount > 0 && (
            <div className="mb-6 rounded-lg border bg-muted/30 px-3 py-2">
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-1.5 flex">
                {playedCount > 0 && (
                  <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(playedCount / totalCount) * 100}%` }} />
                )}
                {confirmedCount > 0 && (
                  <div className="bg-orange-400 h-full transition-all" style={{ width: `${(confirmedCount / totalCount) * 100}%` }} />
                )}
              </div>
              <div className="flex items-center justify-between sm:justify-start sm:gap-6 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{totalCount} partidos</span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/30" />
                  <span className="sm:hidden">Pend. {pendingCount}</span>
                  <span className="hidden sm:inline">Pendientes {pendingCount}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
                  <span className="sm:hidden">Conf. {confirmedCount}</span>
                  <span className="hidden sm:inline">Confirmados {confirmedCount}</span>
                </span>
                <span className="flex items-center gap-1 text-emerald-600">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                  Jugados {playedCount}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-12">
            {/* Ranking */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Ranking</h2>
                <Link href="/ranking" className="text-sm text-primary hover:underline ml-auto">
                  Ver completo
                </Link>
              </div>
              {groupRankings.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {groupRankings.map(({ group, ranking: gr }) => (
                    <div key={group.id}>
                      <h3 className="text-base font-bold mb-2">Grupo {group.number}</h3>
                      <RankingTable entries={gr} />
                    </div>
                  ))}
                </div>
              ) : (
                <RankingTable entries={ranking} />
              )}
            </section>

            {/* Fixture */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Fixture</h2>
                <Link href="/fixture" className="text-sm text-primary hover:underline ml-auto">
                  Ver completo
                </Link>
              </div>

              {confirmed.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-base font-bold mb-2">
                    Próximos partidos confirmados ({confirmed.length})
                  </h3>
                  <div className="space-y-2">
                    {confirmed.slice(0, 5).map((m) => (
                      <FixtureMatchCard
                        key={m.id}
                        match={m}
                        showDate
                        player1Slug={playerMap.get(m.player1Id)}
                        player2Slug={playerMap.get(m.player2Id)}
                        currentUserId={currentUserId}
                        currentPlayerSlug={currentPlayerSlug}
                        reservation={reservationMap.get(m.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {groups.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {groups.map((group) => {
                    const groupMatches = [...upcoming, ...played]
                      .filter((m) => m.group?.id === group.id)
                      .sort((a, b) => {
                        const order = { CONFIRMED: 0, PENDING: 1, PLAYED: 2 } as const
                        const oa = order[a.status as keyof typeof order] ?? 1
                        const ob = order[b.status as keyof typeof order] ?? 1
                        if (oa !== ob) return oa - ob
                        if (!a.scheduledAt) return 1
                        if (!b.scheduledAt) return -1
                        return a.scheduledAt.getTime() - b.scheduledAt.getTime()
                      })
                    if (groupMatches.length === 0) return null

                    return (
                      <div key={group.id}>
                        <h3 className="text-base font-bold mb-2">Grupo {group.number}</h3>
                        <div className="space-y-2">
                          {groupMatches.slice(0, 10).map((m) => (
                            <FixtureMatchCard
                              key={m.id}
                              match={m}
                              showDate
                              player1Slug={playerMap.get(m.player1Id)}
                              player2Slug={playerMap.get(m.player2Id)}
                              currentUserId={currentUserId}
                              currentPlayerSlug={currentPlayerSlug}
                              reservation={reservationMap.get(m.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <>
                  {upcoming.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Próximos partidos</h3>
                      <div className="space-y-2">
                        {upcoming.slice(0, 5).map((m) => (
                          <FixtureMatchCard
                            key={m.id}
                            match={m}
                            showDate
                            player1Slug={playerMap.get(m.player1Id)}
                            player2Slug={playerMap.get(m.player2Id)}
                            currentUserId={currentUserId}
                            currentPlayerSlug={currentPlayerSlug}
                            reservation={reservationMap.get(m.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {played.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Últimos resultados</h3>
                      <div className="space-y-2">
                        {played.slice(0, 5).map((m) => (
                          <FixtureMatchCard
                            key={m.id}
                            match={m}
                            showDate
                            player1Slug={playerMap.get(m.player1Id)}
                            player2Slug={playerMap.get(m.player2Id)}
                            currentUserId={currentUserId}
                            currentPlayerSlug={currentPlayerSlug}
                            reservation={reservationMap.get(m.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {upcoming.length === 0 && played.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay partidos en esta categoría.</p>
              )}
            </section>
          </div>
        </TabsContent>
      ))}
    </Tabs>

    {/* Reglamento */}
    <Collapsible className="mt-8 rounded-lg border border-input">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2.5 text-left cursor-pointer hover:bg-muted/50 transition-colors group">
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold flex-1">Reglamento</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        {tournament.rules ? (
          <div
            className="tiptap-content text-sm"
            dangerouslySetInnerHTML={{ __html: tournament.rules }}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">
            El reglamento estará disponible en breve.
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
    </>
  )
}
