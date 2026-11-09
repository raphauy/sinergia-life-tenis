import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPairByPublicSlug } from '@/services/doubles-pair-service'
import { getCanonicalPlayerSlugs } from '@/services/player-service'
import { getDoublesTournamentView, matchesOfPair, standingOfPair } from '@/services/doubles-view-service'
import { memberFullName, pairFullName, pairShortName } from '@/lib/pair-display'
import { initials } from '@/lib/format-name'
import { blobUrl } from '@/lib/blob-url'
import { formatDateOnly } from '@/lib/date-utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DoublesMatchRow } from '@/components/doubles/doubles-match-row'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const found = await getPairByPublicSlug(slug)
  if (!found) return { title: 'Pareja no encontrada' }
  const name = pairFullName(found.pair)
  const title = `${name} - ${found.tournament.name} - Life Tenis`
  const description = `${name}: pareja del ${found.tournament.name} (dobles) en Life Montevideo. Grupo, posición y partidos.`
  return { title, description, openGraph: { title, description } }
}

export default async function ParejaPage({ params }: Props) {
  const { slug } = await params
  const found = await getPairByPublicSlug(slug)
  if (!found) notFound()
  const { pair, tournament } = found

  const members = [pair.captain, pair.partner]
  const [profileSlugs, view] = await Promise.all([
    getCanonicalPlayerSlugs(members.map((m) => m.userId)),
    getDoublesTournamentView(pair.categoryId),
  ])
  const standing = standingOfPair(view, pair.slug)
  const matches = matchesOfPair(view, pair.slug)
  const played = matches.filter((m) => m.score != null).length

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <div className="mb-3 flex -space-x-3">
          {members.map((m) => (
            <Avatar key={m.userId} className="h-16 w-16 border-2 border-background">
              <AvatarImage src={blobUrl(m.image) || undefined} />
              <AvatarFallback className="text-lg">{initials(m.firstName, m.lastName)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <h1 className="text-2xl font-bold leading-tight">
          {members.map((m, i) => {
            const profile = profileSlugs.get(m.userId)
            return (
              <span key={m.userId}>
                {i > 0 && <span className="text-muted-foreground"> / </span>}
                {profile ? (
                  <Link href={`/jugador/${profile}`} className="hover:underline">
                    {memberFullName(m)}
                  </Link>
                ) : (
                  memberFullName(m)
                )}
              </span>
            )
          })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <Link href={`/torneo/${tournament.slug}`} className="hover:underline">
            {tournament.name}
          </Link>{' '}
          · Dobles · {formatDateOnly(tournament.startDate)}
        </p>
        {standing && (
          <p className="mt-2 text-sm">
            <span className="font-semibold">Grupo {standing.group.letter}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="font-semibold">{standing.standing.position}°</span>
            <span className="text-muted-foreground">
              {' '}
              en el grupo · {standing.standing.pj} PJ, {standing.standing.pg} PG, DG{' '}
              {standing.standing.dg > 0 ? `+${standing.standing.dg}` : standing.standing.dg}
            </span>
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Partidos <span className="text-sm font-normal text-muted-foreground">({played} de {matches.length} jugados)</span>
        </h2>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">{pairShortName(pair)} todavía no tiene partidos.</p>
        ) : (
          <div className="space-y-1.5">
            {matches.map((m) => (
              <DoublesMatchRow key={m.id} match={m} showLabel />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
