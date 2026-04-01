import { getTournaments } from '@/services/tournament-service'
import { MatchCreateForm } from './match-create-form'

export const metadata = { title: 'Nuevo partido' }

export default async function NuevoPartidoPage() {
  const tournaments = await getTournaments()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Nuevo partido</h1>
      <MatchCreateForm
        tournaments={tournaments.map((t) => ({
          id: t.id,
          name: t.name,
          categories: t.categories.map((c) => ({ id: c.id, name: c.name })),
        }))}
      />
    </div>
  )
}
