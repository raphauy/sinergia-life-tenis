import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTournamentBySlug } from '@/services/tournament-service'
import { getActivePlayerSlugByUserId } from '@/services/player-service'
import { TournamentDashboard } from '@/components/tournament-dashboard'
import { getDoublesTournamentView } from '@/services/doubles-view-service'
import { DoublesTournamentBody } from '@/components/doubles/doubles-tournament-view'
import { doublesDateLine, doublesDayStatus } from '@/components/doubles/doubles-hero'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const tournament = await getTournamentBySlug(slug)
  if (!tournament) return { title: 'Torneo no encontrado' }
  if (tournament.modality === 'DOUBLES') {
    return {
      title: `${tournament.name} - Life Tenis`,
      description: `${tournament.name} (${doublesDateLine(tournament.startDate)}): grupos, partidos y resultados - Club Life Montevideo`,
    }
  }
  return {
    title: `${tournament.name} - Life Tenis`,
    description: `Ranking, fixture y resultados del ${tournament.name} - Club Life Montevideo`,
  }
}

export default async function TorneoPage({ params }: Props) {
  const { slug } = await params
  const [session, tournament] = await Promise.all([auth(), getTournamentBySlug(slug)])
  if (!tournament) notFound()

  // Dobles: la misma vista por grupos del home en modo torneo, sin hero ni franja.
  if (tournament.modality === 'DOUBLES') {
    const category = tournament.categories[0]
    const view = category ? await getDoublesTournamentView(category.id) : null
    const status = view ? doublesDayStatus(view) : null
    return (
      <div className="mx-auto max-w-3xl lg:max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <p className="text-sm text-muted-foreground">
            {doublesDateLine(tournament.startDate)}
            {status ? ` · ${status}` : ''}
          </p>
        </div>
        {view ? <DoublesTournamentBody view={view} /> : <p className="text-muted-foreground">No hay categorías configuradas.</p>}
      </div>
    )
  }

  const currentPlayerSlug = session?.user
    ? ((await getActivePlayerSlugByUserId(session.user.id)) ?? undefined)
    : undefined

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <p className="text-sm text-muted-foreground">Torneo</p>
      </div>
      <TournamentDashboard
        tournament={tournament}
        currentUserId={session?.user?.id}
        currentPlayerSlug={currentPlayerSlug}
      />
    </div>
  )
}
