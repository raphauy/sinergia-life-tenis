import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTournamentBySlug } from '@/services/tournament-service'
import { getActivePlayerSlugByUserId } from '@/services/player-service'
import { TournamentDashboard } from '@/components/tournament-dashboard'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const tournament = await getTournamentBySlug(slug)
  if (!tournament) return { title: 'Torneo no encontrado' }
  return {
    title: `${tournament.name} - Life Tenis`,
    description: `Ranking, fixture y resultados del ${tournament.name} - Club Life Montevideo`,
  }
}

export default async function TorneoPage({ params }: Props) {
  const { slug } = await params
  const [session, tournament] = await Promise.all([auth(), getTournamentBySlug(slug)])
  if (!tournament) notFound()

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
