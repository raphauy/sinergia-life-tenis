import type { Cup, MatchStage, MatchStatus } from '@prisma/client'
import { formatMatchScore } from '@/lib/format-score'
import { pairShortName } from '@/lib/pair-display'
import { CUP_ORDER, CUP_TITLES, doublesSlotLabel, doublesStageLabel, groupLetter } from '@/lib/doubles-format'
import { prisma } from '@/lib/prisma'
import { getMatches } from './match-service'
import { rankDoublesPlayers } from './ranking-service'
import { computeGroupQualifiers } from './bracket-service'
import { getPairsByCategory, type DoublesPair } from './doubles-pair-service'

/**
 * Vista de un torneo de dobles (home en modo torneo, /torneo/[slug], perfil de pareja
 * y sección Dobles del perfil): grupos con su tabla por pareja, sus partidos y la
 * Definición por copa. Una sola categoría (la Copa Summum tiene una). Tres consultas
 * (partidos, grupos con sus jugadores, parejas); la tabla y los clasificados de cada
 * grupo se calculan en memoria con las mismas funciones que `getRankingByGroup` y
 * `getGroupQualifiers`.
 */

/** Minutos que se considera "en juego" un partido desde su hora, si no tiene resultado. */
export const DOUBLES_LIVE_MINUTES = 25

export interface DoublesPairView {
  slug: string
  shortName: string
  pair: DoublesPair
}

export interface DoublesMatchView {
  id: string
  status: MatchStatus
  stage: MatchStage
  cup: Cup | null
  bracketPosition: number | null
  groupLetter: string | null
  scheduledAt: Date | null
  courtNumber: number | null
  side1: DoublesPairView | null
  side2: DoublesPairView | null
  /** Texto del lado sin pareja definida ("1° Grupo A", "Ganador Semifinal 1"). */
  slot1: string
  slot2: string
  /** Score orientado a side1, o null si no se jugó. */
  score: string | null
  winnerSide: 1 | 2 | null
  live: boolean
  /** "Grupo A", "Semifinal 1 · Copa de Oro", "Final · Copa de Plata". */
  label: string
}

export interface DoublesStandingView {
  position: number
  pair: DoublesPairView
  pj: number
  pg: number
  dg: number
  /** 1° o 2° ya asegurado (resaltado en la tabla). */
  decided: boolean
  /** Empate de 3+ parejas que define la organización (ver rankDoublesPlayers). */
  tied: boolean
}

export interface DoublesGroupView {
  id: string
  letter: string
  played: number
  total: number
  standings: DoublesStandingView[]
  matches: DoublesMatchView[]
  /** Grupo terminado con un empate sin resolver: sus clasificados esperan al admin. */
  hasUnresolvedTie: boolean
}

export interface DoublesCupView {
  cup: Cup
  title: string
  semis: DoublesMatchView[]
  final: DoublesMatchView | null
  champion: DoublesPairView | null
}

export interface DoublesTournamentView {
  categoryId: string
  /** Todos los partidos (grupo y Definición), por hora. */
  matches: DoublesMatchView[]
  groups: DoublesGroupView[]
  cups: DoublesCupView[]
  /** Hay al menos una pareja en una semifinal: la Definición va arriba de los grupos. */
  definitionStarted: boolean
  playedCount: number
  totalCount: number
  liveCount: number
  firstMatchAt: Date | null
}


type CategoryMatch = Awaited<ReturnType<typeof getMatches>>[number]

function byTime(a: { scheduledAt: Date | null; courtNumber: number | null }, b: { scheduledAt: Date | null; courtNumber: number | null }) {
  const ta = a.scheduledAt?.getTime() ?? Infinity
  const tb = b.scheduledAt?.getTime() ?? Infinity
  if (ta !== tb) return ta - tb
  return (a.courtNumber ?? 0) - (b.courtNumber ?? 0)
}

export async function getDoublesTournamentView(categoryId: string, now: Date = new Date()): Promise<DoublesTournamentView> {
  const [matches, groups, pairs] = await Promise.all([
    getMatches({ categoryId }),
    prisma.group.findMany({
      where: { categoryId },
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
        tiebreakOrder: true,
        // Mismo filtro que getRankingByGroup.
        players: {
          where: { isActive: true, withdrawnAt: null, userId: { not: null } },
          select: { id: true, slug: true, userId: true },
        },
      },
    }),
    getPairsByCategory(categoryId),
  ])

  const pairViews = new Map<string, DoublesPairView>()
  const byCaptain = new Map<string, DoublesPairView>()
  for (const pair of pairs) {
    const view = { slug: pair.slug, shortName: pairShortName(pair), pair }
    pairViews.set(pair.slug, view)
    byCaptain.set(pair.captain.userId, view)
  }

  const toView = (m: CategoryMatch): DoublesMatchView => {
    const side1 = m.player1Id ? byCaptain.get(m.player1Id) ?? null : null
    const side2 = m.player2Id ? byCaptain.get(m.player2Id) ?? null : null
    const winnerId = m.result?.winnerId
    const start = m.scheduledAt?.getTime()
    const live =
      !m.result &&
      m.status !== 'CANCELLED' &&
      side1 != null &&
      side2 != null &&
      start != null &&
      start <= now.getTime() &&
      now.getTime() < start + DOUBLES_LIVE_MINUTES * 60_000
    return {
      id: m.id,
      status: m.status,
      stage: m.stage,
      cup: m.cup,
      bracketPosition: m.bracketPosition,
      groupLetter: m.group ? groupLetter(m.group.number) : null,
      scheduledAt: m.scheduledAt,
      courtNumber: m.courtNumber,
      side1,
      side2,
      slot1: doublesSlotLabel(m, 1),
      slot2: doublesSlotLabel(m, 2),
      score: m.result ? formatMatchScore(m.result) : null,
      winnerSide: winnerId ? (winnerId === m.player1Id ? 1 : winnerId === m.player2Id ? 2 : null) : null,
      live,
      label: doublesStageLabel(m),
    }
  }

  const active = matches.filter((m) => m.status !== 'CANCELLED').sort(byTime)
  const views = active.map(toView)
  const viewById = new Map(views.map((v) => [v.id, v]))

  const groupViews = groups.map((g): DoublesGroupView => {
    const ownMatches = matches.filter((m) => m.stage === 'GROUP' && m.groupId === g.id)
    const ranking = rankDoublesPlayers(
      g.players.map((p) => ({ id: p.id, slug: p.slug, userId: p.userId! })),
      pairs,
      ownMatches.filter((m) => m.status === 'PLAYED'),
      g.tiebreakOrder
    )
    const qualifiers = computeGroupQualifiers(
      ranking,
      ownMatches.filter((m) => m.status !== 'CANCELLED').length,
      ownMatches.filter((m) => m.status === 'PLAYED').length,
      ownMatches.filter((m) => m.status === 'PENDING' || m.status === 'CONFIRMED')
    )
    const groupMatches = active.filter((m) => m.stage === 'GROUP' && m.group?.id === g.id).map((m) => viewById.get(m.id)!)
    const standings = ranking.flatMap((e): DoublesStandingView[] => {
      const pair = e.pairSlug ? pairViews.get(e.pairSlug) : undefined
      if (!pair) return []
      const decided =
        (e.position === 1 && qualifiers.firstDecided) || (e.position === 2 && qualifiers.secondDecided)
      return [{ position: e.position, pair, pj: e.pj, pg: e.pg, dg: e.gamesDiff, decided, tied: e.tied === true }]
    })
    return {
      id: g.id,
      letter: groupLetter(g.number),
      played: groupMatches.filter((m) => m.status === 'PLAYED').length,
      total: groupMatches.length,
      standings,
      matches: groupMatches,
      hasUnresolvedTie: qualifiers.fullyDecided && standings.some((s) => s.tied),
    }
  })

  const cups: DoublesCupView[] = []
  for (const cup of CUP_ORDER) {
    const own = views.filter((v) => v.cup === cup)
    if (own.length === 0) continue
    const final = own.find((v) => v.stage === 'FINAL') ?? null
    const champion = final?.winnerSide ? (final.winnerSide === 1 ? final.side1 : final.side2) : null
    cups.push({
      cup,
      title: CUP_TITLES[cup],
      semis: own.filter((v) => v.stage === 'SEMIFINAL').sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0)),
      final,
      champion,
    })
  }

  return {
    categoryId,
    matches: views,
    groups: groupViews,
    cups,
    definitionStarted: cups.some((c) => c.semis.some((s) => s.side1 || s.side2)),
    playedCount: views.filter((v) => v.status === 'PLAYED').length,
    totalCount: views.length,
    liveCount: views.filter((v) => v.live).length,
    firstMatchAt: views.find((v) => v.scheduledAt)?.scheduledAt ?? null,
  }
}

/** Los partidos de una pareja dentro de la vista (grupo y Definición), por hora. */
export function matchesOfPair(view: DoublesTournamentView, slug: string): DoublesMatchView[] {
  return view.matches.filter((m) => m.side1?.slug === slug || m.side2?.slug === slug)
}

/** Grupo y posición de una pareja en la vista, o null. */
export function standingOfPair(
  view: DoublesTournamentView,
  slug: string
): { group: DoublesGroupView; standing: DoublesStandingView } | null {
  for (const group of view.groups) {
    const standing = group.standings.find((s) => s.pair.slug === slug)
    if (standing) return { group, standing }
  }
  return null
}
