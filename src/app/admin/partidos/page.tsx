import Link from 'next/link'
import { getPairsForMatches } from '@/services/doubles-pair-service'
import { matchSideName } from '@/lib/pair-display'
import { formatMatchScore } from '@/lib/format-score'
import { getMatches } from '@/services/match-service'
import { getTournaments } from '@/services/tournament-service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTimeUY } from '@/lib/date-utils'
import { COURTS } from '@/lib/constants'
import { Plus } from 'lucide-react'
import { MatchFilters } from './match-filters'
import { MATCH_STATUS_LABELS, MATCH_STATUS_VARIANTS } from '@/lib/match-status'
import type { MatchStatus } from '@prisma/client'

export const metadata = { title: 'Partidos' }

interface Props {
  searchParams: Promise<{ tournamentId?: string; categoryId?: string; status?: string; q?: string }>
}

export default async function PartidosPage({ searchParams }: Props) {
  const params = await searchParams
  const tournaments = await getTournaments()
  const allMatches = await getMatches({
    tournamentId: params.tournamentId || undefined,
    categoryId: params.categoryId || undefined,
    status: (params.status as MatchStatus) || undefined,
  })

  // En dobles cada lado es una pareja (ADR 0002): se muestra y se busca por pareja.
  const pairsByMatch = await getPairsForMatches(allMatches)
  const named = allMatches.map((m) => {
    const pairs = pairsByMatch.get(m.id) ?? null
    return {
      ...m,
      side1Name: matchSideName(pairs, 1, m) || 'Por definir',
      side2Name: matchSideName(pairs, 2, m) || 'Por definir',
    }
  })
  const q = params.q?.toLowerCase().trim()
  const matches = q
    ? named.filter((m) => m.side1Name.toLowerCase().includes(q) || m.side2Name.toLowerCase().includes(q))
    : named

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Partidos</h1>
          <p className="text-muted-foreground text-sm">{matches.length} partido(s)</p>
        </div>
        <Button render={<Link href="/admin/partidos/nuevo" />}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo partido
        </Button>
      </div>

      <MatchFilters
        tournaments={tournaments.map((t) => ({
          id: t.id,
          name: t.name,
          categories: t.categories.map((c) => ({ id: c.id, name: c.name })),
        }))}
      />

      {matches.length === 0 ? (
        <p className="text-muted-foreground mt-4">No hay partidos.</p>
      ) : (
        <div className="space-y-3 mt-4">
          {matches.map((m) => (
            <Link
              key={m.id}
              href={`/admin/partidos/${m.id}`}
              className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {m.side1Name} vs {m.side2Name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {m.tournament
                      ? `${m.tournament.name}${m.category ? ` — ${m.category.name}` : ''}`
                      : 'La Escalera'}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={MATCH_STATUS_VARIANTS[m.status]}>{MATCH_STATUS_LABELS[m.status]}</Badge>
                  {m.scheduledAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTimeUY(m.scheduledAt)}
                      {m.externalCourt
                        ? ' — Fuera del club'
                        : m.courtNumber && ` — ${COURTS.find((c) => c.number === m.courtNumber)?.name}`}
                    </p>
                  )}
                  {m.result && (
                    <p className="text-xs font-mono mt-1">
                      {formatMatchScore(m.result)}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
