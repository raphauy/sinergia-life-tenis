import { getDisplayName } from './display-name'
import { fullName } from './format-name'
import type { DoublesPair, MatchPairs, PairMember } from '@/services/doubles-pair-service'

/**
 * Presentación de parejas de dobles sin acceso a la base: la usan componentes de
 * cliente (FixtureMatchCard) y de servidor por igual. Solo importa tipos del servicio.
 */

/** Nombre corto de una persona de la pareja: su nombre para mostrar ("Rapha C."). */
export function memberShortName(m: PairMember): string {
  return getDisplayName(m, m.email.split('@')[0])
}

/** Nombre completo de una persona de la pareja ("Raphael Carvalho"). */
export function memberFullName(m: PairMember): string {
  return fullName(m.firstName, m.lastName) || m.email.split('@')[0]
}

/** "Rapha C. / Fede C." (en el orden en que el club mandó la pareja). */
export function pairShortName(pair: DoublesPair): string {
  return `${memberShortName(pair.captain)} / ${memberShortName(pair.partner)}`
}

/** "Raphael Carvalho / Federico Canet". */
export function pairFullName(pair: DoublesPair): string {
  return `${memberFullName(pair.captain)} / ${memberFullName(pair.partner)}`
}

export function isUserInPair(pair: DoublesPair, userId: string): boolean {
  return pair.captain.userId === userId || pair.partner.userId === userId
}

type SidePlayer = { firstName: string | null; lastName: string | null } | null

/**
 * Nombre de un lado del partido: en dobles la pareja (nombre corto o "Por definir"),
 * en singles el jugador. `pairs` null = no es de dobles.
 */
export function matchSideName(pairs: MatchPairs | null, side: 1 | 2, player: SidePlayer): string {
  if (pairs) {
    const pair = side === 1 ? pairs.side1 : pairs.side2
    return pair ? pairShortName(pair) : 'Por definir'
  }
  return fullName(player?.firstName, player?.lastName)
}

/** Link de un lado: /pareja/[slug] en dobles, /jugador/[slug canónico] en singles. */
export function matchSideHref(pairs: MatchPairs | null, side: 1 | 2, playerSlug: string | undefined): string | undefined {
  if (pairs) {
    const pair = side === 1 ? pairs.side1 : pairs.side2
    return pair ? `/pareja/${pair.slug}` : undefined
  }
  return playerSlug ? `/jugador/${playerSlug}` : undefined
}
