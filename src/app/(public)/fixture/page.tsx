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
    ? `Fixture - ${tournament.name} - Life Tenis`
    : 'Fixture - Life Tenis'

  return {
    title,
    description: tournament
      ? `Fixture y resultados del torneo ${tournament.name}`
      : 'Fixture de tenis - Life Tenis',
    openGraph: {
      title,
      description: tournament
        ? `Mirá el fixture y resultados del torneo ${tournament.name}`
        : 'Fixture de tenis',
      type: 'website',
    },
  }
}

async function getPlayerMap(categoryId: string): Promise<Map<string, string>> {
  const players = await prisma.player.findMany({
    where: { categoryId, userId: { not: null } },
    select: { id: true, userId: true },
  })
  return new Map(players.map((p) => [p.userId!, p.id]))
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

      return { cat, upcoming, played, playerMap, groups }
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

          {fixtureData.map(({ cat, upcoming, played, playerMap, groups }) => (
            <TabsContent key={cat.id} value={cat.id}>
              <div className="space-y-6">
                {groups.length > 0 ? (
                  // Grouped display
                  <>
                    {groups.map((group) => {
                      const groupUpcoming = upcoming.filter((m) => m.group?.id === group.id)
                      const groupPlayed = played.filter((m) => m.group?.id === group.id)
                      if (groupUpcoming.length === 0 && groupPlayed.length === 0) return null

                      return (
                        <div key={group.id} className="space-y-3">
                          <h2 className="text-sm font-semibold border-b pb-1">Grupo {group.number}</h2>

                          {groupUpcoming.length > 0 && (
                            <section>
                              <h3 className="text-xs font-medium text-muted-foreground mb-2">
                                Próximos partidos ({groupUpcoming.length})
                              </h3>
                              <div className="space-y-2">
                                {groupUpcoming.map((m) => (
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

                          {groupPlayed.length > 0 && (
                            <section>
                              <h3 className="text-xs font-medium text-muted-foreground mb-2">
                                Resultados ({groupPlayed.length})
                              </h3>
                              <div className="space-y-2">
                                {groupPlayed.map((m) => (
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
                    })}

                    {/* Matches without group */}
                    {(() => {
                      const ungroupedUpcoming = upcoming.filter((m) => !m.group)
                      const ungroupedPlayed = played.filter((m) => !m.group)
                      if (ungroupedUpcoming.length === 0 && ungroupedPlayed.length === 0) return null

                      return (
                        <div className="space-y-3">
                          <h2 className="text-sm font-semibold border-b pb-1">General</h2>
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
