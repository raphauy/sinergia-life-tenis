/**
 * Backfill de User.displayName (#11): a cada jugador del torneo sin nombre para mostrar
 * y con nombre cargado le pone el sugerido por suggestDisplayName ("Rapha C.").
 * Los que ya tienen displayName no se tocan.
 *
 * Se corre DESPUÉS de cargar el torneo (scripts/cargar-dobles.ts) y solo toca a sus
 * jugadores. Un displayName null también significa que la persona lo vació a propósito
 * en /perfil para mostrar su nombre completo: una corrida posterior se lo rellena.
 *
 * Uso:
 *   pnpm tsx scripts/backfill-display-name.ts --torneo copa-summum --dry-run  # solo muestra
 *   pnpm tsx scripts/backfill-display-name.ts --torneo copa-summum            # pide confirmación y escribe
 *   (--yes saltea la confirmación; --todos en vez de --torneo lo aplica a TODOS los usuarios)
 *
 * El dry-run marca lo que conviene revisar a mano antes de prender la portada
 * (se corrige en /admin/torneos/<slug>, "Para mostrar: …"):
 *   - apodos de la tabla que no salen del nombre (Martín → "Tincho", Andrés → "Andy")
 *   - nombres para mostrar repetidos dentro del torneo ("Nico P." dos veces)
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config()

import readline from 'readline'
import { PrismaClient } from '@prisma/client'
import { DISPLAY_NAME_MIN, suggestDisplayName } from '../src/lib/display-name'

// Misma URL que cargar-dobles y prisma migrate: no escribir en bases distintas.
const dbUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
const prisma = new PrismaClient({ datasourceUrl: dbUrl })

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const yes = args.includes('--yes')
const all = args.includes('--todos')
const slugIndex = args.indexOf('--torneo')
const tournamentSlug = slugIndex >= 0 ? args[slugIndex + 1] : undefined

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.on('close', () => resolve(''))
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase())
      rl.close()
    })
  })
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** El nombre corto no sale del nombre real ("Tincho" para Martín): es un apodo de la tabla. */
function isNickname(displayName: string, fullName: string): boolean {
  const given = normalize(displayName.split(/\s+/)[0] ?? '')
  return !fullName.split(/\s+/).some((w) => normalize(w).startsWith(given))
}

async function main() {
  if (!all && (!tournamentSlug || tournamentSlug.startsWith('--'))) {
    console.error('Uso: pnpm tsx scripts/backfill-display-name.ts --torneo <slug> [--dry-run] [--yes]   (o --todos para todos los usuarios)')
    process.exitCode = 1
    return
  }

  const host = (dbUrl ?? '').match(/@([^/:?]+)/)?.[1] ?? '?'
  console.log(`Base: ${host}${dryRun ? ' (dry-run)' : ''}`)

  let scope: { players: { some: { tournamentId: string } } } | Record<string, never> = {}
  if (!all) {
    const tournament = await prisma.tournament.findUnique({ where: { slug: tournamentSlug! }, select: { id: true, name: true } })
    if (!tournament) {
      console.error(`\n✖ No existe el torneo "${tournamentSlug}" en esta base. Cargalo primero (scripts/cargar-dobles.ts).`)
      process.exitCode = 1
      return
    }
    scope = { players: { some: { tournamentId: tournament.id } } }
    console.log(`Alcance: jugadores de ${tournament.name}\n`)
  } else {
    console.log('Alcance: TODOS los usuarios\n')
  }

  // Todos los del alcance (con y sin displayName): hacen falta para ver repetidos.
  const users = await prisma.user.findMany({
    where: scope,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      displayName: true,
      // Fallback: hay usuarios con el nombre solo en su inscripción (Player).
      players: { select: { firstName: true, lastName: true }, orderBy: { createdAt: 'asc' }, take: 1 },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })

  const toUpdate: { id: string; name: string; displayName: string; revisar: string }[] = []
  const skipped: { email: string; reason: string }[] = []
  /** Nombre para mostrar final de cada persona del alcance → quiénes lo llevan. */
  const finalNames = new Map<string, string[]>()
  const track = (displayName: string, name: string) => {
    const key = normalize(displayName)
    finalNames.set(key, [...(finalNames.get(key) ?? []), name])
  }

  for (const u of users) {
    const source = u.firstName?.trim() || u.lastName?.trim() ? u : (u.players[0] ?? u)
    const name = [source.firstName, source.lastName].map((s) => s?.trim()).filter(Boolean).join(' ')
    if (u.displayName?.trim()) {
      track(u.displayName.trim(), name || u.email)
      continue
    }
    if (!name) {
      skipped.push({ email: u.email, reason: 'sin nombre' })
      continue
    }
    const displayName = suggestDisplayName({ firstName: source.firstName, lastName: source.lastName })
    if (!displayName || displayName.length < DISPLAY_NAME_MIN) {
      skipped.push({ email: u.email, reason: `sugerencia inválida (${JSON.stringify(displayName)})` })
      track(name, name)
      continue
    }
    track(displayName, name)
    toUpdate.push({ id: u.id, name, displayName, revisar: isNickname(displayName, name) ? 'apodo' : '' })
  }

  const repeated = [...finalNames.entries()].filter(([, names]) => names.length > 1)
  const repeatedKeys = new Set(repeated.map(([key]) => key))
  for (const row of toUpdate) {
    if (repeatedKeys.has(normalize(row.displayName))) row.revisar = [row.revisar, 'repetido'].filter(Boolean).join(' + ')
  }

  if (toUpdate.length) console.table(toUpdate.map(({ name, displayName, revisar }) => ({ name, displayName, revisar })))
  console.log(`\nA actualizar: ${toUpdate.length} · ya tenían nombre para mostrar (no se tocan): ${users.length - toUpdate.length - skipped.length}`)
  if (skipped.length) {
    console.log(`No se pudo: ${skipped.length}`)
    console.table(skipped)
  }

  const nicknames = toUpdate.filter((r) => r.revisar.includes('apodo'))
  if (nicknames.length) {
    console.log(`\n⚠ Apodos que no salen del nombre (${nicknames.length}): confirmar que les dicen así.`)
    for (const r of nicknames) console.log(`  - ${r.name} → ${r.displayName}`)
  }
  if (repeated.length) {
    console.log(`\n⚠ Nombres para mostrar repetidos (${repeated.length}): en la tabla no se distinguen.`)
    for (const [, names] of repeated) console.log(`  - ${names.join(' · ')}`)
  }
  if (nicknames.length || repeated.length) {
    console.log('\nSe corrigen a mano en el admin del torneo ("Para mostrar: …"), antes o después de escribir.')
  }

  if (dryRun || toUpdate.length === 0) return

  if (!yes) {
    const answer = await ask(`\n¿Escribir ${toUpdate.length} nombres para mostrar en ${host}? (s/N) `)
    if (answer !== 's' && answer !== 'si' && answer !== 'sí') {
      console.log('Cancelado: no se escribió nada.')
      process.exitCode = 1
      return
    }
  }

  let written = 0
  for (const row of toUpdate) {
    // displayName: null en el where → no pisa uno cargado entre la lectura y la escritura.
    const { count } = await prisma.user.updateMany({ where: { id: row.id, displayName: null }, data: { displayName: row.displayName } })
    written += count
  }
  console.log(`\nActualizados: ${written}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
