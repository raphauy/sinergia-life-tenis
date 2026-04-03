import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTournamentBySlug } from '@/services/tournament-service'
import { getPlayersByTournament } from '@/services/player-service'
import { getGroupsByCategory } from '@/services/group-service'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { Button } from '@/components/ui/button'
import { formatDateUY } from '@/lib/date-utils'
import { fullName } from '@/lib/format-name'
import { Upload } from 'lucide-react'
import { TournamentDetailClient } from './tournament-detail-client'
import { GroupsSection } from './groups-section'
import { DeleteTournamentButton } from './delete-tournament-button'
import { RulesEditorSection } from './rules-editor-section'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function TournamentDetailPage({ params }: Props) {
  const { slug } = await params
  const tournament = await getTournamentBySlug(slug)
  if (!tournament) notFound()

  const players = await getPlayersByTournament(tournament.id)

  const allGroups = await Promise.all(
    tournament.categories.map((c) => getGroupsByCategory(c.id))
  )
  const groups = allGroups.flat()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            {tournament.isActive && <Badge>Activo</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDateUY(tournament.startDate)} - {formatDateUY(tournament.endDate)}
          </p>
          {tournament.description && (
            <p className="text-sm text-muted-foreground mt-1">{tournament.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href={`/admin/torneos/${slug}/importar`} />}>
            <Upload className="h-4 w-4 mr-1" />
            Importar jugadores
          </Button>
          <DeleteTournamentButton
            tournamentId={tournament.id}
            playerCount={tournament._count.players}
            matchCount={tournament._count.matches}
            groupCount={groups.length}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-1 mb-6">
        {tournament.categories.map((c) => (
          <CategoryBadge key={c.id} name={c.name} />
        ))}
      </div>

      {/* Rules editor */}
      <RulesEditorSection
        tournamentId={tournament.id}
        initialRules={tournament.rules || ''}
      />

      {/* Players list */}
      <TournamentDetailClient
        tournamentSlug={slug}
        players={players}
        categories={tournament.categories}
      />

      {/* Groups management */}
      <GroupsSection
        tournamentSlug={slug}
        categories={tournament.categories}
        groups={groups}
        allPlayers={players.map((p) => ({
          id: p.id,
          firstName: p.user?.firstName ?? p.firstName,
          lastName: p.user?.lastName ?? p.lastName,
          userId: p.userId,
          categoryId: p.categoryId,
          groupId: p.groupId,
        }))}
      />
    </div>
  )
}
