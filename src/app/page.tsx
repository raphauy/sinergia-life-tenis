import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getFeaturedTournament, getTournamentArchive } from '@/services/tournament-service'
import { getDoublesTournamentView } from '@/services/doubles-view-service'
import { DoublesHero, LadderStrip } from '@/components/doubles/doubles-hero'
import { doublesDateLine } from '@/lib/doubles-format'
import { cache } from 'react'
import { DoublesTournamentBody } from '@/components/doubles/doubles-tournament-view'
import { getActivePlayerSlugByUserId } from '@/services/player-service'
import { getLadderView } from '@/services/challenge-service'
import { getPlayerOfTheWeek, getFeaturedMatches, getWeeklyPositionMovement, getLadderWinStreaks, getLadderMonthlyMatches, getMonthlyRatingDeltas, getGallinas } from '@/services/ladder-stats-service'
import { getHeadToHeadByMatch } from '@/services/head-to-head-service'
import { LadderTable } from '@/components/ladder-table'
import { PlayerOfTheWeekCard } from '@/components/player-of-the-week-card'
import { GallinaCard } from '@/components/gallina-card'
import { FeaturedMatches } from '@/components/featured-matches'
import { TournamentArchive } from '@/components/tournament-archive'
import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'

const LADDER_METADATA: Metadata = {
  title: 'La Escalera - Life Tenis',
  description: 'La Escalera de Life Montevideo: el ranking permanente del club, siempre vivo.',
}

interface Props {
  searchParams: Promise<{ vista?: string | string[] }>
}

/**
 * Torneo que el home muestra en modo torneo: el que está en portada, si es de dobles
 * (la vista por grupos es de dobles). `?vista=escalera` fuerza La Escalera (la franja
 * del modo torneo linkea ahí, porque el ranking de La Escalera vive en el home).
 */
async function getHomeTournament(searchParams: Props['searchParams']) {
  const { vista } = await searchParams
  if (vista === 'escalera') return null
  return getFeaturedDoubles()
}

/** Una sola consulta por request (la usan `generateMetadata` y la página). */
const getFeaturedDoubles = cache(async () => {
  const featured = await getFeaturedTournament()
  return featured?.modality === 'DOUBLES' && featured.categories.length > 0 ? featured : null
})

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const tournament = await getHomeTournament(searchParams)
  if (!tournament) return LADDER_METADATA
  const title = `${tournament.name} · Life Tenis`
  const description = `${doublesDateLine(tournament.startDate)} en Life Montevideo: grupos, partidos y resultados en vivo, Copa de Oro y Copa de Plata.`
  const images = [{ url: '/hero-dobles.jpg', width: 1600, height: 600, alt: tournament.name }]
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, images },
    twitter: { card: 'summary_large_image', title, description, images: ['/hero-dobles.jpg'] },
  }
}

export default async function HomePage({ searchParams }: Props) {
  const tournament = await getHomeTournament(searchParams)
  if (tournament) return <TournamentHome tournament={tournament} />
  return <LadderHome />
}

/** Home en modo torneo: hero de dobles, franja a La Escalera, Definición y grupos. */
async function TournamentHome({ tournament }: { tournament: NonNullable<Awaited<ReturnType<typeof getHomeTournament>>> }) {
  const [view, archive] = await Promise.all([
    getDoublesTournamentView(tournament.categories[0].id),
    getTournamentArchive(),
  ])
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader sticky />
      <DoublesHero name={tournament.name} startDate={tournament.startDate} view={view} />
      <LadderStrip />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl lg:max-w-5xl">
        <DoublesTournamentBody view={view} />
        <TournamentArchive tournaments={archive} />
      </main>
      <HomeFooter />
    </div>
  )
}

/** Home de siempre: La Escalera + archivo de torneos al pie. */
async function LadderHome() {
  const session = await auth()

  const [view, tournaments, playerOfWeek, gallinas, featured, movement, winStreaks, monthlyMatches, monthDeltas] = await Promise.all([
    getLadderView(session?.user?.id ?? null),
    getTournamentArchive(),
    getPlayerOfTheWeek(),
    getGallinas(),
    getFeaturedMatches(),
    getWeeklyPositionMovement(),
    getLadderWinStreaks(),
    getLadderMonthlyMatches(),
    getMonthlyRatingDeltas(),
  ])
  const { rows, canChallenge, challengeBlock } = view
  // Historial entre los dos jugadores de cada partido destacado (depende de `featured`).
  const featuredH2H = await getHeadToHeadByMatch(featured.map((f) => f.match))
  const isAdmin = session?.user?.role === 'SUPERADMIN' || session?.user?.role === 'ADMIN'
  // Slug del viewer para los links de "Responder" / "A jugar" en la tabla.
  const currentPlayerSlug = canChallenge && session?.user?.id ? await getActivePlayerSlugByUserId(session.user.id) : null

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader sticky />

      {/* Hero */}
      <section className="relative h-56 md:h-72 overflow-hidden">
        <Image
          src="/hero-cancha.png"
          alt="Cancha de tenis Life Montevideo"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">La Escalera</h1>
          <p className="text-base md:text-lg opacity-90">El ranking permanente del club, siempre vivo</p>
          <Link
            href="/escalera"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-white/90 underline underline-offset-4 hover:text-white"
          >
            <HelpCircle className="h-4 w-4" />
            Cómo funciona
          </Link>
        </div>
      </section>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        {rows.length > 0 ? (
          <>
            {playerOfWeek && (
              <div className="mb-6">
                <PlayerOfTheWeekCard player={playerOfWeek} />
              </div>
            )}
            {gallinas.length > 0 && (
              <div className="mb-6">
                <GallinaCard gallinas={gallinas} />
              </div>
            )}
            <FeaturedMatches matches={featured} headToHead={featuredH2H} />
            <h2 className="mb-3 text-lg font-semibold">Ranking</h2>
            <LadderTable
              rows={rows}
              canChallenge={canChallenge}
              challengeBlock={challengeBlock}
              currentPlayerSlug={currentPlayerSlug}
              viewerUserId={session?.user?.id ?? null}
              movement={movement}
              playerOfWeekUserId={playerOfWeek?.userId ?? null}
              winStreaks={winStreaks}
              monthlyMatches={monthlyMatches}
              monthDeltas={monthDeltas}
            />
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">La Escalera todavía no fue sembrada.</p>
            {isAdmin && (
              <Button className="mt-4" render={<Link href="/admin/escalera" />}>
                Sembrar La Escalera
              </Button>
            )}
          </div>
        )}
        <TournamentArchive tournaments={tournaments} />
      </main>

      <HomeFooter />
    </div>
  )
}

function HomeFooter() {
  return (
    <footer className="border-t py-6">
      <div className="container mx-auto px-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>Life Tenis</span>
        <div className="flex gap-4">
          <Link href="/escalera" className="hover:text-foreground">Cómo funciona</Link>
          <Link href="/partidos" className="hover:text-foreground">Partidos</Link>
          <Link href="/calendario" className="hover:text-foreground">Calendario</Link>
        </div>
      </div>
    </footer>
  )
}
