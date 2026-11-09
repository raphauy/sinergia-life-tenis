import { fullName } from './format-name'

/** Largo máximo del nombre para mostrar (mismo límite que valida el perfil). */
export const DISPLAY_NAME_MAX = 20
/** Largo mínimo del nombre para mostrar. */
export const DISPLAY_NAME_MIN = 2

/** Partículas de apellido que no cuentan para la inicial ("de León" → "L."). */
const SURNAME_PARTICLES = new Set(['de', 'del', 'da', 'das', 'do', 'dos', 'la', 'las', 'los', 'di', 'van', 'von', 'der', 'den', 'ter', 'y'])

/**
 * Diminutivos conocidos del primer nombre. Clave: nombre sin tildes y en
 * minúsculas. Tabla revisable: agregar o cambiar acá.
 */
const DIMINUTIVES: Record<string, string> = {
  raphael: 'Rapha',
  javier: 'Javi',
  sebastian: 'Seba',
  nicolas: 'Nico',
  federico: 'Fede',
  santiago: 'Santi',
  francisco: 'Fran',
  alejandro: 'Ale',
  gonzalo: 'Gonza',
  agustin: 'Agus',
  maximiliano: 'Maxi',
  guillermo: 'Guille',
  martin: 'Tincho',
  matias: 'Mati',
  rodrigo: 'Rodri',
  facundo: 'Facu',
  ignacio: 'Nacho',
  leonardo: 'Leo',
  fernando: 'Fer',
  andres: 'Andy',
  joaquin: 'Joaco',
  mauricio: 'Mauri',
  marcelo: 'Marce',
  gabriel: 'Gabi',
  daniel: 'Dani',
  eduardo: 'Edu',
  patricio: 'Pato',
  valentina: 'Valen',
  florencia: 'Flor',
  carolina: 'Caro',
  victoria: 'Vicky',
  alejandra: 'Ale',
  gabriela: 'Gabi',
  daniela: 'Dani',
  natalia: 'Nati',
  cecilia: 'Ceci',
  maria: 'Mari',
  josefina: 'Jose',
}

function normalize(word: string): string {
  return word.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase('es') + word.slice(1).toLocaleLowerCase('es')
}

function words(value: string | null | undefined): string[] {
  return (value ?? '').trim().split(/\s+/).filter(Boolean)
}

type NameParts = { firstName: string | null; lastName: string | null }

/** Primeros nombres que en compuesto se dejan de lado: "María José" → "José". */
const SKIPPED_IN_COMPOUND = new Set(['maria'])

const isParticle = (w: string) => SURNAME_PARTICLES.has(normalize(w))

/**
 * Nombre para mostrar sugerido: diminutivo del primer nombre (o el primer
 * nombre tal cual) + inicial del primer apellido con punto. "Raphael Carvalho"
 * → "Rapha C.". Saltea partículas del apellido ("de León" → "L."). Si el primer
 * nombre es María y hay un segundo nombre, se usa ese ("María José Pérez" →
 * "José P."). Con una sola palabra, solo esa. Devuelve null si no hay nombre.
 * Acepta el nombre completo como string o `{ firstName, lastName }`. Sin
 * `lastName`, lo que sigue al primer nombre en `firstName` cuenta como apellido
 * (salvo María + 3 o más palabras: "Maria Noel Iglesias" → "Noel I.").
 */
export function suggestDisplayName(name: string | NameParts): string | null {
  const parts = typeof name === 'string' ? { firstName: name, lastName: null } : name
  const first = words(parts.firstName)
  const last = words(parts.lastName)

  let givenWords: string[]
  let surnameWords: string[]
  if (first.length === 0) {
    givenWords = last.slice(0, 1)
    surnameWords = last.slice(1)
  } else if (last.length > 0) {
    givenWords = first
    surnameWords = last
  } else if (SKIPPED_IN_COMPOUND.has(normalize(first[0])) && first.length >= 3) {
    givenWords = first.slice(0, 2)
    surnameWords = first.slice(2)
  } else {
    givenWords = first.slice(0, 1)
    surnameWords = first.slice(1)
  }
  if (givenWords.length === 0) return null

  let givenWord = givenWords[0]
  if (SKIPPED_IN_COMPOUND.has(normalize(givenWord))) {
    givenWord = givenWords.slice(1).find((w) => !isParticle(w)) ?? givenWord
  }
  const surnameWord = surnameWords.find((w) => !isParticle(w)) ?? surnameWords[0]

  const given = DIMINUTIVES[normalize(givenWord)] ?? capitalize(givenWord)
  const initial = surnameWord?.match(/\p{L}/u)?.[0]?.toLocaleUpperCase('es')
  if (!initial) return given.slice(0, DISPLAY_NAME_MAX)

  const suffix = ` ${initial}.`
  return given.slice(0, DISPLAY_NAME_MAX - suffix.length) + suffix
}

/**
 * Nombre a mostrar de una persona: su `displayName` si lo tiene; si no, el
 * nombre completo; si tampoco, `fallback`.
 */
export function getDisplayName(
  user: NameParts & { displayName?: string | null },
  fallback = 'Sin nombre'
): string {
  return user.displayName?.trim() || fullName(user.firstName, user.lastName) || fallback
}
