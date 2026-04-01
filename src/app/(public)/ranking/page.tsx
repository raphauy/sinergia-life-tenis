import type { Metadata } from 'next'
import { getActiveTournament } from '@/services/tournament-service'
import { getRankingByCategory, getRankingByGroup } from '@/services/ranking-service'
import { getGroupsByCategory } from '@/services/group-service'
import { RankingTable } from '@/components/ranking-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export async function generateMetadata(): Promise<Metadata> {
  const tournament = await getActiveTournament()
  const title = tournament
    ? `Ranking - ${tournament.name}`
    : 'Ranking'
  const description = tournament
    ? `Posiciones y estadísticas del ${tournament.name} - Club Sinergia Life`
    : 'Ranking de tenis - Club Sinergia Life'

  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default async function RankingPage() {
  const tournament = await getActiveTournament()

  if (!tournament) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Ranking</h1>
        <p className="text-muted-foreground">No hay torneo activo.</p>
      </div>
    )
  }

  const categories = tournament.categories
  const rankingData = await Promise.all(
    categories.map(async (cat) => {
      const [ranking, groups] = await Promise.all([
        getRankingByCategory(cat.id),
        getGroupsByCategory(cat.id),
      ])

      const groupRankings = await Promise.all(
        groups.map(async (g) => ({
          group: g,
          ranking: await getRankingByGroup(g.id),
        }))
      )

      return { cat, ranking, groupRankings }
    })
  )

  const defaultTab = categories[0]?.id

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ranking</h1>
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

          {rankingData.map(({ cat, ranking, groupRankings }) => (
            <TabsContent key={cat.id} value={cat.id}>
              <div className="space-y-6">
                {groupRankings.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {groupRankings.map(({ group, ranking: groupRanking }) => (
                        <section key={group.id}>
                          <h2 className="text-base font-bold mb-3">
                            Grupo {group.number}
                          </h2>
                          <RankingTable entries={groupRanking} />
                        </section>
                      ))}
                    </div>
                    <section>
                      <h2 className="text-base font-bold mb-3">
                        Ranking general
                      </h2>
                      <RankingTable entries={ranking} />
                    </section>
                  </>
                )}
                {groupRankings.length === 0 && (
                  <RankingTable entries={ranking} />
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
