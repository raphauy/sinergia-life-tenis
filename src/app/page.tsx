import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getActiveTournament } from '@/services/tournament-service'
import { getActivePlayerSlugByUserId } from '@/services/player-service'
import { getLadderView } from '@/services/challenge-service'
import { getPlayerOfTheWeek, getFeaturedMatches, getWeeklyPositionMovement, getLadderWinStreaks, getLadderMonthlyMatches, getMonthlyRatingDeltas } from '@/services/ladder-stats-service'
import { LadderTable } from '@/components/ladder-table'
import { PlayerOfTheWeekCard } from '@/components/player-of-the-week-card'
import { FeaturedMatches } from '@/components/featured-matches'
import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { ChevronRight, HelpCircle, Trophy } from 'lucide-react'

export const metadata: Metadata = {
  title: 'La Escalera - Life Tenis',
  description: 'La Escalera de Life Montevideo: el ranking permanente del club, siempre vivo.',
}

export default async function HomePage() {
  const session = await auth()

  const [view, tournament, playerOfWeek, featured, movement, winStreaks, monthlyMatches, monthDeltas] = await Promise.all([
    getLadderView(session?.user?.id ?? null),
    getActiveTournament(),
    getPlayerOfTheWeek(),
    getFeaturedMatches(),
    getWeeklyPositionMovement(),
    getLadderWinStreaks(),
    getLadderMonthlyMatches(),
    getMonthlyRatingDeltas(),
  ])
  const { rows, canChallenge } = view
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
            <FeaturedMatches matches={featured} />
            <h2 className="mb-3 text-lg font-semibold">Ranking</h2>
            <LadderTable
              rows={rows}
              canChallenge={canChallenge}
              currentPlayerSlug={currentPlayerSlug}
              viewerUserId={session?.user?.id ?? null}
              movement={movement}
              playerOfWeekUserId={playerOfWeek?.userId ?? null}
              winStreaks={winStreaks}
              monthlyMatches={monthlyMatches}
              monthDeltas={monthDeltas}
            />
            {tournament && (
              <Link
                href={`/torneo/${tournament.slug}`}
                className="mt-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
              >
                <Trophy className="h-4 w-4 text-primary shrink-0" />
                <span className="flex-1">
                  Torneo <span className="font-medium">{tournament.name}</span> — ranking, fixture y bracket
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">La Escalera todavía no fue sembrada.</p>
            {isAdmin && (
              <Button className="mt-4" render={<Link href="/admin/escalera" />}>
                Sembrar La Escalera
              </Button>
            )}
            {tournament && (
              <div className="mt-6">
                <Link href={`/torneo/${tournament.slug}`} className="text-sm text-primary hover:underline">
                  Ver el torneo {tournament.name}
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
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
    </div>
  )
}
