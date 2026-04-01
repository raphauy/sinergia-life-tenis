import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMatchById } from '@/services/match-service'
import { prisma } from '@/lib/prisma'
import { fullName } from '@/lib/format-name'
import { formatDateTimeUY } from '@/lib/date-utils'
import { COURTS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { BackButton } from '@/components/back-button'
import { MATCH_STATUS_LABELS, MATCH_STATUS_VARIANTS } from '@/lib/match-status'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const match = await getMatchById(id)
  if (!match) return { title: 'Partido no encontrado' }

  const p1 = fullName(match.player1.firstName, match.player1.lastName)
  const p2 = fullName(match.player2.firstName, match.player2.lastName)
  const title = `${p1} vs ${p2} - ${match.tournament.name}`
  const description = `${p1} vs ${p2} - Categoría ${match.category.name} - ${match.tournament.name}`

  return { title, description, openGraph: { title, description } }
}


export default async function PartidoPublicPage({ params }: Props) {
  const { id } = await params
  const match = await getMatchById(id)
  if (!match) notFound()

  const p1Name = fullName(match.player1.firstName, match.player1.lastName) || 'Jugador 1'
  const p2Name = fullName(match.player2.firstName, match.player2.lastName) || 'Jugador 2'
  const court = COURTS.find((c) => c.number === match.courtNumber)

  // Get player slugs for linking
  const playerSlugs = await prisma.player.findMany({
    where: { userId: { in: [match.player1Id, match.player2Id] }, isActive: true },
    select: { slug: true, userId: true },
  })
  const slugMap = new Map(playerSlugs.map((p) => [p.userId, p.slug]))
  const p1Slug = slugMap.get(match.player1Id)
  const p2Slug = slugMap.get(match.player2Id)

  const winnerIs1 = match.result?.winnerId === match.player1Id
  const winnerIs2 = match.result?.winnerId === match.player2Id

  const r = match.result
  const score = r
    ? `${r.set1Player1}-${r.set1Player2}${r.set2Player1 != null ? `  ${r.set2Player1}-${r.set2Player2}` : ''}${r.superTbPlayer1 != null ? `  [${r.superTbPlayer1}-${r.superTbPlayer2}]` : ''}`
    : null

  return (
    <div className="max-w-xl mx-auto">
      <BackButton />

      <div className="rounded-lg border p-6">
        {/* Tournament & category header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">{match.tournament.name}</h1>
            <Badge variant={MATCH_STATUS_VARIANTS[match.status] || 'outline'}>
              {MATCH_STATUS_LABELS[match.status] || match.status}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <CategoryBadge name={match.category.name} />
            {match.group && (
              <Badge variant="secondary-outline">Grupo {match.group.number}</Badge>
            )}
          </div>
        </div>

        {/* Players & score */}
        <div className="flex items-center justify-between py-3 border-t">
          <div className="space-y-1">
            {p1Slug ? (
              <Link href={`/jugador/${p1Slug}`} className={`block text-xl hover:underline ${winnerIs1 ? 'font-bold' : 'font-medium'}`}>
                {p1Name}
              </Link>
            ) : (
              <p className={`text-xl ${winnerIs1 ? 'font-bold' : 'font-medium'}`}>{p1Name}</p>
            )}
            {p2Slug ? (
              <Link href={`/jugador/${p2Slug}`} className={`block text-xl hover:underline ${winnerIs2 ? 'font-bold' : 'font-medium'}`}>
                {p2Name}
              </Link>
            ) : (
              <p className={`text-xl ${winnerIs2 ? 'font-bold' : 'font-medium'}`}>{p2Name}</p>
            )}
          </div>

          {score && (
            <span className="font-mono text-2xl font-bold">{score}</span>
          )}
        </div>

        {/* Details footer */}
        <div className="flex items-center gap-2 pt-3 border-t text-sm text-muted-foreground">
          {match.scheduledAt && (
            <span>{formatDateTimeUY(match.scheduledAt)}</span>
          )}
          {court && <span>— {court.name}</span>}
          {match.result && (
            <>
              {match.scheduledAt && <span>—</span>}
              <span>Ganador: <span className="font-medium text-foreground">{winnerIs1 ? p1Name : p2Name}</span></span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
