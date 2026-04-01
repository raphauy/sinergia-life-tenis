import type { Metadata } from 'next'
import { getActiveTournament } from '@/services/tournament-service'
import { getMatches } from '@/services/match-service'
import { getGroupsByCategory } from '@/services/group-service'
import { MatchCard } from '@/components/match-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { prisma } from '@/lib/prisma'

export async function generateMetadata(): Promise<Metadata> {
  const tournament = await getActiveTournament()
  const title = tournament
    ? `Fixture - ${tournament.name}`
    : 'Fixture'
  const description = tournament
    ? `Fixture y resultados del ${tournament.name} - Club Sinergia Life`
    : 'Fixture de tenis - Club Sinergia Life'

  return { title, description }
}

async function getPlayerMap(categoryId: string): Promise<Map<string, string>> {
  const players = await prisma.player.findMany({
    where: { categoryId, userId: { not: null } },
    select: { slug: true, userId: true },
  })
  return new Map(players.map((p) => [p.userId!, p.slug]))
}

export default async function FixturePage() {
  const tournament = await getActiveTournament()

  if (!tournament) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Fixture</h1>
        <p className="text-muted-foreground">No hay torneo activo.</p>
      </div>
    )
  }

  const categories = tournament.categories

  const fixtureData = await Promise.all(
    categories.map(async (cat) => {
      const [matches, playerMap, groups] = await Promise.all([
        getMatches({ categoryId: cat.id }),
        getPlayerMap(cat.id),
        getGroupsByCategory(cat.id),
      ])

      const upcoming = matches.filter((m) => m.status === 'PENDING' || m.status === 'CONFIRMED')
      const played = matches.filter((m) => m.status === 'PLAYED')
      const confirmed = matches
        .filter((m) => m.status === 'CONFIRMED')
        .sort((a, b) => {
          if (!a.scheduledAt) return 1
          if (!b.scheduledAt) return -1
          return a.scheduledAt.getTime() - b.scheduledAt.getTime()
        })

      return { cat, upcoming, played, confirmed, playerMap, groups }
    })
  )

  const defaultTab = categories[0]?.id

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Fixture y Resultados</h1>
        <p className="text-muted-foreground text-sm">{tournament.name}</p>
      </div>

      {categories.length === 0 ? (
        <p className="text-muted-foreground">No hay categorías.</p>
      ) : (
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-6 w-full h-11 bg-orange-100 dark:bg-orange-950">
            {categories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id}>
                Categoría {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {fixtureData.map(({ cat, upcoming, played, confirmed, playerMap, groups }) => (
            <TabsContent key={cat.id} value={cat.id}>
              <div className="space-y-10">
                {confirmed.length > 0 && (
                  <section>
                    <h2 className="text-base font-bold mb-3">
                      Próximos partidos confirmados ({confirmed.length})
                    </h2>
                    <div className="space-y-2">
                      {confirmed.map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          player1LinkId={playerMap.get(m.player1Id)}
                          player2LinkId={playerMap.get(m.player2Id)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {groups.length > 0 ? (
                  // Grouped display
                  <>
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
                          <h2 className="text-base font-bold mb-3">Grupo {group.number}</h2>
                          <div className="space-y-2">
                            {groupMatches.map((m) => (
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

                    {/* Matches without group */}
                    {(() => {
                      const ungroupedUpcoming = upcoming.filter((m) => !m.group)
                      const ungroupedPlayed = played.filter((m) => !m.group)
                      if (ungroupedUpcoming.length === 0 && ungroupedPlayed.length === 0) return null

                      return (
                        <div className="space-y-3">
                          <h2 className="text-base font-bold mb-1">General</h2>
                          {ungroupedUpcoming.length > 0 && (
                            <section>
                              <h3 className="text-xs font-medium text-muted-foreground mb-2">
                                Próximos partidos ({ungroupedUpcoming.length})
                              </h3>
                              <div className="space-y-2">
                                {ungroupedUpcoming.map((m) => (
                                  <MatchCard
                                    key={m.id}
                                    match={m}
                                    player1LinkId={playerMap.get(m.player1Id)}
                                    player2LinkId={playerMap.get(m.player2Id)}
                                  />
                                ))}
                              </div>
                            </section>
                          )}
                          {ungroupedPlayed.length > 0 && (
                            <section>
                              <h3 className="text-xs font-medium text-muted-foreground mb-2">
                                Resultados ({ungroupedPlayed.length})
                              </h3>
                              <div className="space-y-2">
                                {ungroupedPlayed.map((m) => (
                                  <MatchCard
                                    key={m.id}
                                    match={m}
                                    player1LinkId={playerMap.get(m.player1Id)}
                                    player2LinkId={playerMap.get(m.player2Id)}
                                  />
                                ))}
                              </div>
                            </section>
                          )}
                        </div>
                      )
                    })()}
                  </>
                ) : (
                  // Flat display (no groups)
                  <>
                    {upcoming.length > 0 && (
                      <section>
                        <h2 className="text-sm font-medium text-muted-foreground mb-2">
                          Próximos partidos ({upcoming.length})
                        </h2>
                        <div className="space-y-2">
                          {upcoming.map((m) => (
                            <MatchCard
                              key={m.id}
                              match={m}
                              player1LinkId={playerMap.get(m.player1Id)}
                              player2LinkId={playerMap.get(m.player2Id)}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {played.length > 0 && (
                      <section>
                        <h2 className="text-sm font-medium text-muted-foreground mb-2">
                          Resultados ({played.length})
                        </h2>
                        <div className="space-y-2">
                          {played.map((m) => (
                            <MatchCard
                              key={m.id}
                              match={m}
                              player1LinkId={playerMap.get(m.player1Id)}
                              player2LinkId={playerMap.get(m.player2Id)}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}

                {upcoming.length === 0 && played.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No hay partidos en esta categoría.
                  </p>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
