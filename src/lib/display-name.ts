import { fullName } from './format-name'

/** Largo máximo del nombre para mostrar (mismo límite que valida el perfil). */
export const DISPLAY_NAME_MAX = 20
/** Largo mínimo del nombre para mostrar. */
export const DISPLAY_NAME_MIN = 2

/** Partículas de apellido que no cuentan para la inicial ("de León" → "L."). */
const SURNAME_PARTICLES = new Set(['de', 'del', 'da', 'das', 'do', 'dos', 'la', 'las', 'los', 'di', 'van', 'von', 'y'])

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

/**
 * Nombre para mostrar sugerido: diminutivo del primer nombre (o el primer
 * nombre tal cual) + inicial del primer apellido con punto. "Raphael Carvalho"
 * → "Rapha C." (saltea partículas: "de León" → "L."). Con una sola palabra, solo esa. Devuelve null si no hay nombre.
 * Acepta el nombre completo como string o `{ firstName, lastName }` (si
 * `lastName` está vacío, la segunda palabra de `firstName` cuenta como apellido).
 */
export function suggestDisplayName(name: string | NameParts): string | null {
  const parts = typeof name === 'string' ? { firstName: name, lastName: null } : name
  const first = words(parts.firstName)
  const last = words(parts.lastName)
  const givenWord = first[0] ?? last[0]
  if (!givenWord) return null
  const surnameWords = first.length > 0 ? (last.length > 0 ? last : first.slice(1)) : last.slice(1)
  const surnameWord =
    surnameWords.find((w) => !SURNAME_PARTICLES.has(normalize(w))) ?? surnameWords[0]

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
