import { notFound } from 'next/navigation'
import { getTournamentById } from '@/services/tournament-service'
import { CsvImportClient } from './csv-import-client'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata = { title: 'Importar jugadores - Sinergia Life Tenis' }

export default async function ImportarPage({ params }: Props) {
  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Importar jugadores</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Torneo: {tournament.name} — Categorías:{' '}
        {tournament.categories.map((c) => c.name).join(', ')}
      </p>
      <CsvImportClient
        tournamentId={id}
        validCategories={tournament.categories.map((c) => c.name)}
      />
    </div>
  )
}
