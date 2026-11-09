import { getDisplayName } from './display-name'
import { fullName } from './format-name'
import type { DoublesPair, PairMember } from '@/services/doubles-pair-service'

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

/** Letra del grupo en dobles: los grupos se numeran 1–4 en la base y el club los llama A–D. */
export function groupLetter(number: number): string {
  return number >= 1 && number <= 26 ? String.fromCharCode(64 + number) : String(number)
}
