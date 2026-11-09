import type { Cup, MatchStage, MatchStatus } from '@prisma/client'
import { formatMatchScore } from '@/lib/format-score'
import { groupLetter, pairShortName } from '@/lib/pair-display'
import { getMatches } from './match-service'
import { getGroupsByCategory } from './group-service'
import { getRankingByGroup } from './ranking-service'
import { getGroupQualifiers } from './bracket-service'
import { getPairsByCategory, type DoublesPair } from './doubles-pair-service'

/**
 * Vista de un torneo de dobles (home en modo torneo, /torneo/[slug], perfil de pareja
 * y sección Dobles del perfil). Compone servicios: grupos con su tabla por pareja, sus
 * partidos y la Definición por copa. Una sola categoría (la Copa Summum tiene una).
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
}

export interface DoublesGroupView {
  id: string
  letter: string
  played: number
  total: number
  standings: DoublesStandingView[]
  matches: DoublesMatchView[]
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
  groups: DoublesGroupView[]
  cups: DoublesCupView[]
  /** Hay al menos una pareja en una semifinal: la Definición va arriba de los grupos. */
  definitionStarted: boolean
  playedCount: number
  totalCount: number
  liveCount: number
  firstMatchAt: Date | null
}

export const CUP_TITLES: Record<Cup, string> = { GOLD: 'Copa de Oro', SILVER: 'Copa de Plata' }
const CUP_ORDER: Cup[] = ['GOLD', 'SILVER']

type CategoryMatch = Awaited<ReturnType<typeof getMatches>>[number]

function byTime(a: { scheduledAt: Date | null; courtNumber: number | null }, b: { scheduledAt: Date | null; courtNumber: number | null }) {
  const ta = a.scheduledAt?.getTime() ?? Infinity
  const tb = b.scheduledAt?.getTime() ?? Infinity
  if (ta !== tb) return ta - tb
  return (a.courtNumber ?? 0) - (b.courtNumber ?? 0)
}

function slotLabel(m: CategoryMatch, side: 1 | 2): string {
  const group = side === 1 ? m.player1SourceGroup : m.player2SourceGroup
  const position = side === 1 ? m.player1SourcePosition : m.player2SourcePosition
  if (group && position != null) return `${position}° Grupo ${groupLetter(group.number)}`
  if (m.stage === 'FINAL') return `Ganador Semifinal ${side}`
  return 'Por definir'
}

function matchLabel(m: CategoryMatch): string {
  if (m.stage === 'GROUP') return m.group ? `Grupo ${groupLetter(m.group.number)}` : 'Grupo'
  const cup = m.cup ? ` · ${CUP_TITLES[m.cup]}` : ''
  if (m.stage === 'FINAL') return `Final${cup}`
  if (m.stage === 'SEMIFINAL') return `Semifinal${m.bracketPosition ? ` ${m.bracketPosition}` : ''}${cup}`
  return `Cuartos de final${cup}`
}

export async function getDoublesTournamentView(categoryId: string, now: Date = new Date()): Promise<DoublesTournamentView> {
  const [matches, groups, pairs] = await Promise.all([
    getMatches({ categoryId }),
    getGroupsByCategory(categoryId),
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
      slot1: slotLabel(m, 1),
      slot2: slotLabel(m, 2),
      score: m.result ? formatMatchScore(m.result) : null,
      winnerSide: winnerId ? (winnerId === m.player1Id ? 1 : winnerId === m.player2Id ? 2 : null) : null,
      live,
      label: matchLabel(m),
    }
  }

  const active = matches.filter((m) => m.status !== 'CANCELLED').sort(byTime)
  const views = active.map(toView)
  const viewById = new Map(views.map((v) => [v.id, v]))

  const groupViews = await Promise.all(
    groups.map(async (g): Promise<DoublesGroupView> => {
      const [ranking, qualifiers] = await Promise.all([getRankingByGroup(g.id), getGroupQualifiers(g.id)])
      const groupMatches = active.filter((m) => m.stage === 'GROUP' && m.group?.id === g.id).map((m) => viewById.get(m.id)!)
      const standings = ranking.flatMap((e): DoublesStandingView[] => {
        const pair = e.pairSlug ? pairViews.get(e.pairSlug) : undefined
        if (!pair) return []
        const decided =
          (e.position === 1 && qualifiers.firstDecided) || (e.position === 2 && qualifiers.secondDecided)
        return [{ position: e.position, pair, pj: e.pj, pg: e.pg, dg: e.gamesDiff, decided }]
      })
      return {
        id: g.id,
        letter: groupLetter(g.number),
        played: groupMatches.filter((m) => m.status === 'PLAYED').length,
        total: groupMatches.length,
        standings,
        matches: groupMatches,
      }
    })
  )

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
  const all = [
    ...view.groups.flatMap((g) => g.matches),
    ...view.cups.flatMap((c) => [...c.semis, ...(c.final ? [c.final] : [])]),
  ]
  return all.filter((m) => m.side1?.slug === slug || m.side2?.slug === slug).sort(byTime)
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
