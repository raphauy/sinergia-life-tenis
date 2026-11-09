import { getDisplayName } from './display-name'
import { fullName } from './format-name'
import type { Cup, MatchStage } from '@prisma/client'
import type {
  MatchPairs,
  PublicDoublesPair,
  PublicMatchPairs,
  PublicPairMember,
} from '@/services/doubles-pair-service'
import { doublesSlotLabel } from './doubles-format'

/**
 * Presentación de parejas de dobles sin acceso a la base: la usan componentes de
 * cliente (FixtureMatchCard) y de servidor por igual. Solo importa tipos del servicio.
 * Las funciones de nombres aceptan la pareja completa o la pública (sin email).
 */

type NamedMember = Pick<PublicPairMember, 'userId' | 'firstName' | 'lastName' | 'displayName'>
type PairLike = { slug: string; captain: NamedMember; partner: NamedMember }
type PairsLike = { side1: PairLike | null; side2: PairLike | null }

/** Nombre corto de una persona de la pareja: su nombre para mostrar ("Rapha C."). */
export function memberShortName(m: NamedMember): string {
  return getDisplayName(m)
}

/** Nombre completo de una persona de la pareja ("Raphael Carvalho"). */
export function memberFullName(m: NamedMember): string {
  return fullName(m.firstName, m.lastName) || 'Sin nombre'
}

/** "Rapha C. / Fede C." (en el orden en que el club mandó la pareja). */
export function pairShortName(pair: PairLike): string {
  return `${memberShortName(pair.captain)} / ${memberShortName(pair.partner)}`
}

/** "Raphael Carvalho / Federico Canet". */
export function pairFullName(pair: PairLike): string {
  return `${memberFullName(pair.captain)} / ${memberFullName(pair.partner)}`
}

export function isUserInPair(pair: PairLike, userId: string): boolean {
  return pair.captain.userId === userId || pair.partner.userId === userId
}

/** Lo que hace falta de un partido para nombrar un lado sin pareja todavía ("1° Grupo A"). */
type SideMatch = {
  stage: MatchStage
  cup?: Cup | null
  player1: { firstName: string | null; lastName: string | null } | null
  player2: { firstName: string | null; lastName: string | null } | null
  player1SourceGroup?: { number: number } | null
  player2SourceGroup?: { number: number } | null
  player1SourcePosition?: number | null
  player2SourcePosition?: number | null
}

/**
 * Nombre de un lado del partido: en dobles la pareja (nombre corto) o, sin definir,
 * de dónde sale ("1° Grupo A", "Ganador Semifinal 1"); en singles el jugador.
 * `pairs` null = no es de dobles.
 */
export function matchSideName(pairs: PairsLike | null, side: 1 | 2, match: SideMatch): string {
  if (pairs) {
    const pair = side === 1 ? pairs.side1 : pairs.side2
    return pair ? pairShortName(pair) : doublesSlotLabel(match, side)
  }
  const player = side === 1 ? match.player1 : match.player2
  return fullName(player?.firstName, player?.lastName)
}

/** Link de un lado: /pareja/[slug] en dobles, /jugador/[slug canónico] en singles. */
export function matchSideHref(pairs: PairsLike | null, side: 1 | 2, playerSlug: string | undefined): string | undefined {
  if (pairs) {
    const pair = side === 1 ? pairs.side1 : pairs.side2
    return pair ? `/pareja/${pair.slug}` : undefined
  }
  return playerSlug ? `/jugador/${playerSlug}` : undefined
}

function publicPair(pair: MatchPairs['side1']): PublicDoublesPair | null {
  if (!pair) return null
  const strip = (m: (typeof pair)['captain']): PublicPairMember => ({
    playerId: m.playerId,
    playerSlug: m.playerSlug,
    userId: m.userId,
    firstName: m.firstName,
    lastName: m.lastName,
    displayName: m.displayName,
    image: m.image,
  })
  return { ...pair, captain: strip(pair.captain), partner: strip(pair.partner) }
}

/** Las parejas de un partido sin emails, para pasarlas a un componente de cliente. */
export function toPublicPairs(pairs: MatchPairs | null): PublicMatchPairs | null {
  return pairs ? { side1: publicPair(pairs.side1), side2: publicPair(pairs.side2) } : null
}

/**
 * Invitados al evento "Agendar" de un partido de dobles: los otros tres, solo si el
 * viewer juega el partido. Se calcula en el servidor (los emails no van al cliente
 * salvo para quien juega).
 */
export function doublesGuestEmails(pairs: MatchPairs | null, viewerUserId: string | null | undefined): string[] {
  if (!pairs || !viewerUserId) return []
  const members = [pairs.side1, pairs.side2].flatMap((p) => (p ? [p.captain, p.partner] : []))
  if (!members.some((m) => m.userId === viewerUserId)) return []
  return members.filter((m) => m.userId !== viewerUserId).map((m) => m.email)
}

type ContactFields = { email?: string | null; phone?: string | null }

/**
 * Partido listo para `FixtureMatchCard` (componente de cliente). En dobles saca los
 * emails de las parejas y también el email y el teléfono de `player1/player2` (son
 * los capitanes; la card de dobles no los usa). Singles queda igual.
 */
export function toCardMatch<
  T extends { pairs: MatchPairs | null; player1: (object & ContactFields) | null; player2: (object & ContactFields) | null },
>(m: T): Omit<T, 'pairs'> & { pairs: PublicMatchPairs | null } {
  const pairs = toPublicPairs(m.pairs)
  if (!pairs) return { ...m, pairs }
  const hide = <U extends (object & ContactFields) | null>(p: U): U => (p ? { ...p, email: null, phone: null } : p)
  return { ...m, pairs, player1: hide(m.player1), player2: hide(m.player2) }
}
