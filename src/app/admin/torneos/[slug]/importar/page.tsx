import { notFound } from 'next/navigation'
import { getTournamentBySlug } from '@/services/tournament-service'
import { CsvImportClient } from './csv-import-client'

interface Props {
  params: Promise<{ slug: string }>
}

export const metadata = { title: 'Importar jugadores - Life Tenis' }

export default async function ImportarPage({ params }: Props) {
  const { slug } = await params
  const tournament = await getTournamentBySlug(slug)
  if (!tournament) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Importar jugadores</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Torneo: {tournament.name} — Categorías:{' '}
        {tournament.categories.map((c) => c.name).join(', ')}
      </p>
      <CsvImportClient
        tournamentId={tournament.id}
        tournamentSlug={slug}
        validCategories={tournament.categories.map((c) => c.name)}
      />
    </div>
  )
}
