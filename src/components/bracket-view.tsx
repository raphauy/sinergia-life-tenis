import { BracketMatchCard, type BracketMatchCardMatch } from '@/components/bracket-match-card'
import { Trophy } from 'lucide-react'

export type BracketViewMatch = BracketMatchCardMatch & {
  category: { name: string }
  group?: { id: string; number: number } | null
}

interface BracketViewProps {
  quarterfinals: BracketViewMatch[]
  semifinals: BracketViewMatch[]
  final: BracketViewMatch | null
  finalsDate: Date | null
  playerSlugs?: Map<string, string>
  currentUserId?: string
  currentPlayerSlug?: string
  reservationMap?: Map<string, { scheduledAt: Date; courtNumber: number }>
}

/**
 * Groups QFs by the SF they feed into. With 4 QFs (formats A/B): QF1+QF2→SF1,
 * QF3+QF4→SF2. With 2 QFs (format C): QF1→SF1, QF2→SF2.
 */
function groupQFsBySemi(qfs: BracketViewMatch[]): BracketViewMatch[][] {
  const sorted = [...qfs].sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0))
  if (sorted.length === 4) {
    return [
      [sorted[0], sorted[1]],
      [sorted[2], sorted[3]],
    ]
  }
  return sorted.map((qf) => [qf])
}

/**
 * Renders a CSS bracket connector ")" that groups a pair of matches and labels
 * the destination of their winners. For a single match, it renders a simple
 * arrow with the label.
 */
function PairConnector({ label, size }: { label: string; size: 'pair' | 'single' }) {
  if (size === 'single') {
    return (
      <div className="relative w-10 sm:w-14 shrink-0 flex items-center">
        <div className="w-2 sm:w-3 h-px bg-primary/40" />
        <span className="ml-0.5 sm:ml-1 text-[9px] sm:text-[10px] font-bold uppercase text-primary/70 whitespace-nowrap">
          {label}
        </span>
      </div>
    )
  }
  return (
    <div className="relative w-10 sm:w-14 shrink-0 flex items-center py-1">
      {/* Right-side bracket "}" using borders */}
      <div className="h-[calc(100%-24px)] w-1.5 sm:w-2 border-r-2 border-t-2 border-b-2 border-primary/40 rounded-r-md" />
      {/* Stem going right */}
      <div className="w-2 sm:w-3 h-px bg-primary/40" />
      {/* Label floats on the stem */}
      <span className="ml-0.5 sm:ml-1 text-[9px] sm:text-[10px] font-bold uppercase text-primary/70 whitespace-nowrap">
        {label}
      </span>
    </div>
  )
}

function MatchPair({
  matches,
  label,
  playerSlugs,
  currentUserId,
  currentPlayerSlug,
  reservationMap,
  fallbackDate,
  accent,
}: {
  matches: BracketViewMatch[]
  label: string
  playerSlugs?: Map<string, string>
  currentUserId?: string
  currentPlayerSlug?: string
  reservationMap?: Map<string, { scheduledAt: Date; courtNumber: number }>
  fallbackDate?: Date | null
  accent?: 'default' | 'final'
}) {
  return (
    <div className="flex items-stretch">
      <div className="flex-1 space-y-1.5">
        {matches.map((m) => (
          <BracketMatchCard
            key={m.id}
            match={m}
            player1Slug={m.player1Id ? playerSlugs?.get(m.player1Id) : undefined}
            player2Slug={m.player2Id ? playerSlugs?.get(m.player2Id) : undefined}
            currentUserId={currentUserId}
            currentPlayerSlug={currentPlayerSlug}
            reservation={reservationMap?.get(m.id)}
            fallbackDate={fallbackDate}
            accent={accent}
          />
        ))}
      </div>
      <PairConnector label={label} size={matches.length === 1 ? 'single' : 'pair'} />
    </div>
  )
}

export function BracketView({
  quarterfinals,
  semifinals,
  final,
  finalsDate,
  playerSlugs,
  currentUserId,
  currentPlayerSlug,
  reservationMap,
}: BracketViewProps) {
  const hasAny = quarterfinals.length > 0 || semifinals.length > 0 || final != null
  if (!hasAny) return null

  const qfGroups = groupQFsBySemi(quarterfinals)
  const sortedSemis = [...semifinals].sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0))

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Fase eliminatoria</h2>
      </div>

      <div className="rounded-lg border bg-muted/20 p-2 sm:p-4">
        {/* Quarterfinals */}
        {quarterfinals.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider mb-2">
              Cuartos
            </h3>
            <div className="space-y-3">
              {qfGroups.map((group, i) => (
                <MatchPair
                  key={i}
                  matches={group}
                  label={`SF${i + 1}`}
                  playerSlugs={playerSlugs}
                  currentUserId={currentUserId}
                  currentPlayerSlug={currentPlayerSlug}
                  reservationMap={reservationMap}
                />
              ))}
            </div>
          </div>
        )}

        {/* Semifinals */}
        {semifinals.length > 0 && (
          <div className="mt-7 sm:mt-8">
            <h3 className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider mb-2">
              Semifinales
            </h3>
            <MatchPair
              matches={sortedSemis}
              label="Final"
              playerSlugs={playerSlugs}
              currentUserId={currentUserId}
              currentPlayerSlug={currentPlayerSlug}
              reservationMap={reservationMap}
              fallbackDate={finalsDate}
            />
          </div>
        )}

        {/* Final */}
        {final && (
          <div className="mt-7 sm:mt-8">
            <h3 className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400 tracking-wider mb-2 flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              Final
            </h3>
            <BracketMatchCard
              match={final}
              player1Slug={final.player1Id ? playerSlugs?.get(final.player1Id) : undefined}
              player2Slug={final.player2Id ? playerSlugs?.get(final.player2Id) : undefined}
              currentUserId={currentUserId}
              currentPlayerSlug={currentPlayerSlug}
              reservation={reservationMap?.get(final.id)}
              fallbackDate={finalsDate}
              accent="final"
            />
          </div>
        )}
      </div>
    </section>
  )
}
