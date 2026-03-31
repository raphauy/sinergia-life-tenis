import type { Metadata } from 'next'
import { getActiveTournament } from '@/services/tournament-service'
import { getRankingByCategory } from '@/services/ranking-service'
import { RankingTable } from '@/components/ranking-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export async function generateMetadata(): Promise<Metadata> {
  const tournament = await getActiveTournament()
  const title = tournament
    ? `Ranking - ${tournament.name} - Sinergia Life Tenis`
    : 'Ranking - Sinergia Life Tenis'

  return {
    title,
    description: tournament
      ? `Ranking del torneo ${tournament.name} - Sinergia Life Tenis`
      : 'Ranking de tenis - Sinergia Life Tenis',
    openGraph: {
      title,
      description: tournament
        ? `Mirá el ranking del torneo ${tournament.name}`
        : 'Ranking de tenis',
      type: 'website',
    },
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
    categories.map(async (cat) => ({
      cat,
      ranking: await getRankingByCategory(cat.id),
    }))
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
          <TabsList className="mb-4">
            {categories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id}>
                Categoría {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {rankingData.map(({ cat, ranking }) => (
            <TabsContent key={cat.id} value={cat.id}>
              <RankingTable entries={ranking} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
