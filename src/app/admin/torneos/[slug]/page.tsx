import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTournamentBySlug } from '@/services/tournament-service'
import { getPlayersByTournament } from '@/services/player-service'
import { getGroupsByCategory } from '@/services/group-service'
import { getBracketByCategory } from '@/services/bracket-service'
import { getDisplayNamesByUserIds } from '@/services/user-service'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { Button } from '@/components/ui/button'
import { formatDateOnly } from '@/lib/date-utils'
import { Upload } from 'lucide-react'
import { TournamentDetailClient } from './tournament-detail-client'
import { GroupsSection } from './groups-section'
import { BracketSection } from './bracket-section'
import { DeleteTournamentButton } from './delete-tournament-button'
import { RulesEditorSection } from './rules-editor-section'
import { FeaturedOnHomeSwitch } from './featured-on-home-switch'
import { getPairsForMatches } from '@/services/doubles-pair-service'
import { matchSideName } from '@/lib/pair-display'
import { getDoublesTournamentView } from '@/services/doubles-view-service'
import { DoublesTiebreakSection, type TiedGroup } from './doubles-tiebreak-section'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function TournamentDetailPage({ params }: Props) {
  const { slug } = await params
  const tournament = await getTournamentBySlug(slug)
  if (!tournament) notFound()

  const players = await getPlayersByTournament(tournament.id)
  const displayNames = await getDisplayNamesByUserIds(
    [...new Set(players.map((p) => p.userId).filter((id): id is string => !!id))]
  )

  const allGroups = await Promise.all(
    tournament.categories.map((c) => getGroupsByCategory(c.id))
  )
  const groups = allGroups.flat()

  const bracketsByCategory = await Promise.all(
    tournament.categories.map((c) => getBracketByCategory(c.id))
  )
  const isDoubles = tournament.modality === 'DOUBLES'
  // En dobles cada lado del cuadro es una pareja (ADR 0002): se resuelve acá y se pasa como texto.
  const bracketPairs = isDoubles
    ? await getPairsForMatches(
        tournament.categories.flatMap((cat, i) =>
          bracketsByCategory[i].cups
            .flatMap((c) => [...c.quarterfinals, ...c.semifinals, ...(c.final ? [c.final] : [])])
            .map((m) => ({
              id: m.id,
              categoryId: cat.id,
              player1Id: m.player1?.id ?? null,
              player2Id: m.player2?.id ?? null,
              tournament: { modality: 'DOUBLES' as const },
            })),
        ),
      )
    : null
  // Dobles: grupos terminados con un empate de 3+ parejas que tiene que definir el admin.
  const tiedGroups: TiedGroup[] = []
  if (isDoubles) {
    for (const cat of tournament.categories) {
      const view = await getDoublesTournamentView(cat.id)
      for (const g of view.groups) {
        if (!g.hasUnresolvedTie) continue
        const tied = g.standings.filter((s) => s.tied)
        tiedGroups.push({
          groupId: g.id,
          letter: g.letter,
          firstPosition: tied[0].position,
          pairs: tied.map((s) => ({ captainUserId: s.pair.pair.captain.userId, name: s.pair.shortName })),
        })
      }
    }
  }

  const bracketSectionData = tournament.categories.map((cat, i) => {
    const b = bracketsByCategory[i]
    const allMatches = b.cups.flatMap((c) => [...c.quarterfinals, ...c.semifinals, ...(c.final ? [c.final] : [])])
    return {
      id: cat.id,
      name: cat.name,
      bracket: allMatches.map((m) => ({
        id: m.id,
        stage: m.stage,
        cup: m.cup,
        player1Label: bracketPairs ? matchSideName(bracketPairs.get(m.id) ?? { side1: null, side2: null }, 1, m) : null,
        player2Label: bracketPairs ? matchSideName(bracketPairs.get(m.id) ?? { side1: null, side2: null }, 2, m) : null,
        bracketPosition: m.bracketPosition,
        status: m.status,
        player1: m.player1 ? { id: m.player1.id, firstName: m.player1.firstName, lastName: m.player1.lastName } : null,
        player2: m.player2 ? { id: m.player2.id, firstName: m.player2.firstName, lastName: m.player2.lastName } : null,
        player1SourceGroup: m.player1SourceGroup,
        player2SourceGroup: m.player2SourceGroup,
        player1SourcePosition: m.player1SourcePosition,
        player2SourcePosition: m.player2SourcePosition,
        scheduledAt: m.scheduledAt,
        courtNumber: m.courtNumber,
        hasResult: !!m.result,
      })),
    }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            {tournament.isActive && <Badge>Activo</Badge>}
            {tournament.featuredOnHome && <Badge variant="secondary">En portada</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDateOnly(tournament.startDate)} - {formatDateOnly(tournament.endDate)}
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

      {/* Home en modo torneo: solo existe para torneos de dobles */}
      {tournament.modality === 'DOUBLES' && (
        <FeaturedOnHomeSwitch
          tournamentSlug={slug}
          tournamentId={tournament.id}
          featuredOnHome={tournament.featuredOnHome}
        />
      )}

      {isDoubles && <DoublesTiebreakSection tournamentSlug={slug} groups={tiedGroups} />}

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
        players={players.map((p) => ({
          ...p,
          displayName: p.userId ? (displayNames.get(p.userId) ?? null) : null,
        }))}
        categories={tournament.categories}
      />

      {/* Groups management */}
      <GroupsSection
        tournamentSlug={slug}
        readOnly={isDoubles}
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

      {/* Bracket (elimination stage) */}
      <BracketSection tournamentSlug={slug} categories={bracketSectionData} />
    </div>
  )
}
