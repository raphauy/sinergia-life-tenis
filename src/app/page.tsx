import Image from 'next/image'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma as prismaDb } from '@/lib/prisma'
import { getActiveTournament } from '@/services/tournament-service'
import { getRankingByCategory, getRankingByGroup } from '@/services/ranking-service'
import { getMatches } from '@/services/match-service'
import { getGroupsByCategory } from '@/services/group-service'
import { RankingTable } from '@/components/ranking-table'
import { MatchCard } from '@/components/match-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, Calendar } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export default async function HomePage() {
  const session = await auth()
  const tournament = await getActiveTournament()

  // Determine where to link the logged-in user
  let userHref: string | null = null
  if (session?.user) {
    if (session.user.role === 'SUPERADMIN' || session.user.role === 'ADMIN') {
      userHref = '/admin'
    } else {
      const player = await prismaDb.player.findFirst({
        where: { userId: session.user.id, isActive: true },
        select: { id: true },
      })
      userHref = player ? `/jugador/${player.id}` : '/perfil'
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
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/ranking" className="text-muted-foreground hover:text-foreground">
              Ranking
            </Link>
            <Link href="/fixture" className="text-muted-foreground hover:text-foreground">
              Fixture
            </Link>
            {userHref ? (
              <Link href={userHref} className="text-muted-foreground hover:text-foreground">
                Mi panel
              </Link>
            ) : (
              <Link href="/login" className="text-muted-foreground hover:text-foreground">
                Iniciar sesión
              </Link>
            )}
          </nav>
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
          <TournamentContent tournament={tournament} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Life Tenis</span>
          <div className="flex gap-4">
            <Link href="/ranking" className="hover:text-foreground">Ranking</Link>
            <Link href="/fixture" className="hover:text-foreground">Fixture</Link>
            {userHref ? (
              <Link href={userHref} className="hover:text-foreground">Mi panel</Link>
            ) : (
              <Link href="/login" className="hover:text-foreground">Login</Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

async function TournamentContent({
  tournament,
}: {
  tournament: NonNullable<Awaited<ReturnType<typeof getActiveTournament>>>
}) {
  const categories = tournament.categories

  if (categories.length === 0) {
    return <p className="text-muted-foreground">No hay categorías configuradas.</p>
  }

  // Fetch ranking + matches + groups for all categories
  const data = await Promise.all(
    categories.map(async (cat) => {
      const [ranking, matches, playerMap, groups] = await Promise.all([
        getRankingByCategory(cat.id),
        getMatches({ categoryId: cat.id }),
        getPlayerMap(cat.id),
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

      return { cat, ranking, upcoming, played, confirmed, playerMap, groups, groupRankings }
    })
  )

  const defaultTab = categories[0].id

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="mb-6 w-full h-11 bg-orange-100 dark:bg-orange-950">
        {categories.map((cat) => (
          <TabsTrigger key={cat.id} value={cat.id} className="font-semibold cursor-pointer">
            Categoría {cat.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {data.map(({ cat, ranking, upcoming, played, confirmed, playerMap, groups, groupRankings }) => (
        <TabsContent key={cat.id} value={cat.id}>
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
                      <MatchCard
                        key={m.id}
                        match={m}
                        player1LinkId={playerMap.get(m.player1Id)}
                        player2LinkId={playerMap.get(m.player2Id)}
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
                            <MatchCard
                              key={m.id}
                              match={m}
                              player1LinkId={playerMap.get(m.player1Id)}
                              player2LinkId={playerMap.get(m.player2Id)}
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
                          <MatchCard
                            key={m.id}
                            match={m}
                            player1LinkId={playerMap.get(m.player1Id)}
                            player2LinkId={playerMap.get(m.player2Id)}
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
                          <MatchCard
                            key={m.id}
                            match={m}
                            player1LinkId={playerMap.get(m.player1Id)}
                            player2LinkId={playerMap.get(m.player2Id)}
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
  )
}

/** Map userId -> playerId for linking to public profiles */
async function getPlayerMap(categoryId: string): Promise<Map<string, string>> {
  const players = await prisma.player.findMany({
    where: { categoryId, userId: { not: null } },
    select: { id: true, userId: true },
  })
  return new Map(players.map((p) => [p.userId!, p.id]))
}
