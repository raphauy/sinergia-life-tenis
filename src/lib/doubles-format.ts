import type { Cup, MatchStage } from '@prisma/client'
import { formatTimeUY, longDateOnly } from './date-utils'
import type { DoublesTournamentView } from '@/services/doubles-view-service'

/** Formato de textos del torneo de dobles, sin acceso a la base (sirve en cliente y servidor). */

export const CUP_TITLES: Record<Cup, string> = { GOLD: 'Copa de Oro', SILVER: 'Copa de Plata' }

/** Letra del grupo en dobles: los grupos se numeran 1–4 en la base y el club los llama A–D. */
export function groupLetter(number: number): string {
  return number >= 1 && number <= 26 ? String.fromCharCode(64 + number) : String(number)
}

/** Nombre del grupo según la modalidad: letra en dobles, número en singles. */
export function groupName(number: number, isDoubles: boolean): string {
  return isDoubles ? groupLetter(number) : String(number)
}

/** De dónde sale un lado de la Definición sin pareja todavía: "1° Grupo A", "Ganador Semifinal 1". */
export function doublesSlotLabel(
  m: {
    stage: MatchStage
    player1SourceGroup?: { number: number } | null
    player2SourceGroup?: { number: number } | null
    player1SourcePosition?: number | null
    player2SourcePosition?: number | null
  },
  side: 1 | 2
): string {
  const group = side === 1 ? m.player1SourceGroup : m.player2SourceGroup
  const position = side === 1 ? m.player1SourcePosition : m.player2SourcePosition
  if (group && position != null) return `${position}° Grupo ${groupLetter(group.number)}`
  if (m.stage === 'FINAL') return `Ganador Semifinal ${side}`
  return 'Por definir'
}

/** "Grupo A", "Semifinal 1 · Copa de Oro", "Final · Copa de Plata". */
export function doublesStageLabel(m: {
  stage: MatchStage
  cup: Cup | null
  bracketPosition: number | null
  group: { number: number } | null
}): string {
  if (m.stage === 'GROUP') return m.group ? `Grupo ${groupLetter(m.group.number)}` : 'Grupo'
  const cup = m.cup ? ` · ${CUP_TITLES[m.cup]}` : ''
  if (m.stage === 'FINAL') return `Final${cup}`
  if (m.stage === 'SEMIFINAL') return `Semifinal${m.bracketPosition ? ` ${m.bracketPosition}` : ''}${cup}`
  return `Cuartos de final${cup}`
}

/** "Dobles · sábado 14 de noviembre" (fecha solo-día del torneo). */
export function doublesDateLine(startDate: Date): string {
  const date = longDateOnly(startDate)
  return `Dobles · ${date.charAt(0).toLowerCase()}${date.slice(1)}`
}

/** Estado del día en una línea (antes y durante); null si ya hay campeones o no hay partidos. */
export function doublesDayStatus(view: DoublesTournamentView): string | null {
  if (view.cups.some((c) => c.cup === 'GOLD' && c.champion)) return null
  if (view.liveCount > 0) return `En juego · ${view.playedCount} de ${view.totalCount} partidos jugados`
  if (view.playedCount > 0) return `${view.playedCount} de ${view.totalCount} partidos jugados`
  if (view.firstMatchAt) return `Arranca a las ${formatTimeUY(view.firstMatchAt)} · ${view.groups.length} grupos, ${view.totalCount} partidos`
  return null
}
