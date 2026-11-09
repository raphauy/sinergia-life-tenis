/**
 * Carga un torneo de dobles (Copa Summum) desde un JSON: torneo, categoría
 * "Dobles", 4 grupos, un Player por persona, una DoublesPair por pareja, los 24
 * partidos de grupo (CONFIRMED, con hora y cancha) y los 6 de la Definición
 * (semis y finales de Copa de Oro y Copa de Plata, CONFIRMED con hora, cancha y sus
 * fuentes, sin jugadores: así los cuatro cargan el resultado apenas la llave tiene parejas).
 *
 * Uso:
 *   pnpm tsx scripts/cargar-dobles.ts <ruta.json>           # crea el torneo (aborta si el slug ya existe)
 *   pnpm tsx scripts/cargar-dobles.ts <ruta.json> --reset   # borra el torneo con ese slug y lo vuelve a crear
 *   pnpm tsx scripts/cargar-dobles.ts <ruta.json> --reset --force   # ídem aunque ya tenga resultados cargados
 *
 * --reset solo borra torneos de dobles, se niega si ya hay resultados salvo con --force,
 * y conserva la portada (featuredOnHome) del torneo que reemplaza.
 * Antes de escribir imprime el host de la base y pide confirmación; --yes la saltea.
 *
 * Formato del JSON (ejemplo en scripts/dobles/copa-summum.ejemplo.json):
 *   {
 *     "tournament": { "name": "Copa Summum", "slug": "copa-summum", "date": "2026-11-14", "description": "..." },
 *     "groups": [
 *       { "name": "A", "startTime": "08:00", "pairs": [["capitan@x.com", "companero@x.com"], ... 4 parejas] },
 *       ... 4 grupos (A–D, en orden: grupo 1–4)
 *     ],
 *     "finals": { "semis": ["12:00", "12:30"], "final": "13:00", "courts": [1, 2] },
 *     "matchMinutes": 20
 *   }
 *
 * - El primer email de cada pareja es el representante (captainPlayerId, ver ADR 0002):
 *   su User va en player1Id/player2Id de los partidos. Nadie lo ve en la UI.
 * - Las 32 personas tienen que existir como User (match por email en minúsculas).
 *   Si falta alguna se listan y no se escribe nada.
 * - Horas en hora de Uruguay; se guardan en UTC.
 * - Round robin de 4 en 3 tandas por grupo: P1–P2 c1 / P3–P4 c2, P1–P3 c1 / P2–P4 c2,
 *   P1–P4 c1 / P2–P3 c2.
 * - Definición: Oro SF1 = 1°A vs 1°B, Oro SF2 = 1°C vs 1°D; Plata igual con los 2°.
 *   Las finales se llenan con propagateWinner.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { readFileSync } from 'fs'
import * as readline from 'readline'
import { PrismaClient, type Cup, type MatchStage } from '@prisma/client'
import { parseFromUY } from '../src/lib/date-utils'
import { generateSlug } from '../src/lib/utils'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL,
})

const GROUPS = 4
const PAIRS_PER_GROUP = 4
const CATEGORY_NAME = 'Dobles'

interface InputGroup {
  name: string
  startTime: string
  pairs: [string, string][]
}

interface Input {
  tournament: { name: string; slug: string; date: string; description?: string }
  groups: InputGroup[]
  finals: { semis: [string, string]; final: string; courts: [number, number] }
  matchMinutes: number
}

// Round robin de 4 parejas (índices 0–3) en 3 tandas, [cancha 1, cancha 2] por tanda.
const ROUND_ROBIN: [number, number][][] = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
]

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function fail(msg: string): never {
  console.error(`\n✖ ${msg}`)
  process.exit(1)
}

/** Valida la forma del JSON. Devuelve la lista de errores (vacía si está bien). */
function validateShape(input: Input): string[] {
  const errors: string[] = []
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['el JSON tiene que ser un objeto']
  const t = input.tournament
  if (!t || typeof t.name !== 'string' || !t.name.trim()) errors.push('tournament.name es obligatorio')
  if (!t || typeof t.slug !== 'string' || generateSlug(t.slug) !== t.slug) {
    errors.push('tournament.slug es obligatorio y debe ser un slug (minúsculas, guiones)')
  }
  if (!t || !DATE_RE.test(t.date ?? '') || Number.isNaN(new Date(t.date).getTime())) {
    errors.push('tournament.date debe ser yyyy-MM-dd')
  }

  if (!Array.isArray(input.groups) || input.groups.length !== GROUPS) {
    errors.push(`tiene que haber exactamente ${GROUPS} grupos`)
  } else {
    input.groups.forEach((g, i) => {
      const label = `grupo ${g?.name ?? i + 1}`
      if (typeof g?.name !== 'string' || !g.name.trim()) errors.push(`grupo ${i + 1}: falta name`)
      if (!TIME_RE.test(g?.startTime ?? '')) errors.push(`${label}: startTime debe ser HH:mm`)
      if (!Array.isArray(g?.pairs) || g.pairs.length !== PAIRS_PER_GROUP) {
        errors.push(`${label}: tiene que tener exactamente ${PAIRS_PER_GROUP} parejas`)
      } else {
        g.pairs.forEach((p, j) => {
          if (!Array.isArray(p) || p.length !== 2 || p.some((e) => typeof e !== 'string' || !e.includes('@'))) {
            errors.push(`${label}, pareja ${j + 1}: tiene que ser [emailCapitán, emailCompañero]`)
          }
        })
      }
    })
  }

  const f = input.finals
  if (!f || !Array.isArray(f.semis) || f.semis.length !== 2 || f.semis.some((s) => !TIME_RE.test(s))) {
    errors.push('finals.semis tiene que ser dos horas HH:mm')
  }
  if (!f || !TIME_RE.test(f.final ?? '')) errors.push('finals.final debe ser HH:mm')
  if (
    !f ||
    !Array.isArray(f.courts) ||
    f.courts.length !== 2 ||
    f.courts.some((c) => !Number.isInteger(c) || c < 1) ||
    f.courts[0] === f.courts[1]
  ) {
    errors.push('finals.courts tiene que ser dos números de cancha distintos')
  }
  if (!Number.isInteger(input.matchMinutes) || input.matchMinutes <= 0) {
    errors.push('matchMinutes tiene que ser un entero positivo')
  }
  return errors
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

/** Parte del slug de una persona para el slug de la pareja: su apellido, o el nombre completo. */
function personSlugPart(user: { firstName: string | null; lastName: string | null; email: string }): string {
  return (
    generateSlug(user.lastName ?? '') ||
    generateSlug(`${user.firstName ?? ''} ${user.lastName ?? ''}`) ||
    generateSlug(user.email.split('@')[0]) ||
    'jugador'
  )
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    // Sin TTY (stdin cerrado) readline no responde: se toma como "no".
    rl.on('close', () => resolve(''))
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase())
    })
  })
}

async function main() {
  const args = process.argv.slice(2)
  const reset = args.includes('--reset')
  const force = args.includes('--force')
  const yes = args.includes('--yes')
  const path = args.find((a) => !a.startsWith('--'))
  if (!path) fail('Uso: pnpm tsx scripts/cargar-dobles.ts <ruta.json> [--reset [--force]] [--yes]')

  // La base activa de .env.local suele ser Test: decir siempre contra cuál se escribe.
  const dbHost = (process.env.DIRECT_DATABASE_URL ?? '').match(/@([^/:?]+)/)?.[1] ?? '(sin DIRECT_DATABASE_URL)'
  console.log(`Base: ${dbHost}`)
  if (!yes) {
    const answer = await ask(`¿Escribir en esa base${reset ? ' (con --reset)' : ''}? (s/N) `)
    if (answer !== 's' && answer !== 'si' && answer !== 'sí') {
      console.log('Cancelado (sin confirmación; usá --yes para correr sin preguntar).')
      process.exitCode = 1
      return
    }
  }

  let input: Input
  try {
    input = JSON.parse(readFileSync(path, 'utf8')) as Input
  } catch (e) {
    fail(`No se pudo leer el JSON ${path}: ${(e as Error).message}`)
  }

  // ---- 1. Validación completa antes de escribir ----
  const shapeErrors = validateShape(input)
  if (shapeErrors.length > 0) fail(`JSON inválido:\n  - ${shapeErrors.join('\n  - ')}`)

  const groups = input.groups.map((g) => ({
    ...g,
    pairs: g.pairs.map(([a, b]) => [a.trim().toLowerCase(), b.trim().toLowerCase()] as [string, string]),
  }))
  const emails = groups.flatMap((g) => g.pairs.flat())
  const seen = new Set<string>()
  const duplicated = new Set<string>()
  for (const e of emails) (seen.has(e) ? duplicated : seen).add(e)
  if (duplicated.size > 0) fail(`Emails repetidos:\n  - ${[...duplicated].join('\n  - ')}`)

  const users = await prisma.user.findMany({
    where: { email: { in: emails, mode: 'insensitive' } },
    select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
  })
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]))
  const missing = emails.filter((e) => !userByEmail.has(e))
  if (missing.length > 0) {
    fail(`No existen como usuario (${missing.length}); no se escribió nada:\n  - ${missing.join('\n  - ')}`)
  }

  const warnings: string[] = []
  for (const u of users) {
    if (!u.isActive) warnings.push(`El usuario ${u.email} está inactivo`)
    if (!u.firstName?.trim() || !u.lastName?.trim()) warnings.push(`El usuario ${u.email} no tiene nombre y apellido completos`)
  }

  const { tournament: t } = input
  const existing = await prisma.tournament.findUnique({
    where: { slug: t.slug },
    select: { id: true, modality: true, featuredOnHome: true, _count: { select: { matches: { where: { result: { isNot: null } } } } } },
  })
  if (existing && !reset) {
    fail(`Ya existe un torneo con slug "${t.slug}". Corré con --reset para borrarlo y volver a cargarlo.`)
  }
  if (existing && existing.modality !== 'DOUBLES') {
    fail(`El torneo "${t.slug}" que ya existe es de singles: --reset solo borra torneos de dobles.`)
  }
  if (existing && existing._count.matches > 0 && !force) {
    fail(
      `El torneo "${t.slug}" ya tiene ${existing._count.matches} resultado(s) cargado(s): --reset los borraría. ` +
        'Si es lo que querés, agregá --force.',
    )
  }

  // ---- 2. Escritura en una transacción ----
  const { semis, final, courts } = input.finals
  const date = t.date

  const summary = await prisma.$transaction(
    async (tx) => {
      if (existing) {
        // Cascade: categoría, grupos, players, parejas, partidos, resultados y reservas.
        await tx.tournament.delete({ where: { id: existing.id } })
      }

      const tournament = await tx.tournament.create({
        data: {
          name: t.name.trim(),
          slug: t.slug,
          description: t.description?.trim() || null,
          startDate: new Date(date),
          endDate: new Date(date),
          finalsDate: new Date(date),
          modality: 'DOUBLES',
          matchFormat: 'SHORT_SET_4',
          isActive: false,
          // --reset conserva la portada: si el torneo estaba en el home, sigue estando.
          featuredOnHome: existing?.featuredOnHome ?? false,
        },
      })
      const category = await tx.tournamentCategory.create({
        data: { tournamentId: tournament.id, name: CATEGORY_NAME, order: 0 },
      })

      // Slugs de Player: únicos en toda la base. Se reservan los de esta corrida.
      const takenPlayerSlugs = new Set<string>()
      const suffixedPlayerSlugs: string[] = []
      async function uniquePlayerSlug(firstName: string, lastName: string): Promise<string> {
        const base = generateSlug(`${firstName} ${lastName}`) || 'jugador'
        const prefixMatches = await tx.player.findMany({
          where: { slug: { startsWith: base } },
          select: { slug: true },
        })
        const taken = new Set([...prefixMatches.map((p) => p.slug), ...takenPlayerSlugs])
        let slug = base
        for (let n = 1; taken.has(slug); n++) slug = `${base}-${n}`
        if (slug !== base) suffixedPlayerSlugs.push(slug)
        takenPlayerSlugs.add(slug)
        return slug
      }

      const takenPairSlugs = new Set<string>()
      const pairsOut: { group: string; slug: string; captain: string; partner: string }[] = []
      const groupIds: string[] = []
      let playerCount = 0
      let groupMatchCount = 0

      for (const [gi, g] of groups.entries()) {
        const group = await tx.group.create({ data: { categoryId: category.id, number: gi + 1 } })
        groupIds.push(group.id)

        const captainUserIds: string[] = []
        for (const [captainEmail, partnerEmail] of g.pairs) {
          const playerIds: string[] = []
          for (const email of [captainEmail, partnerEmail]) {
            const user = userByEmail.get(email)!
            const firstName = user.firstName?.trim() || email.split('@')[0]
            const lastName = user.lastName?.trim() || ''
            const slug = await uniquePlayerSlug(firstName, lastName)
            const player = await tx.player.create({
              data: {
                slug,
                userId: user.id,
                tournamentId: tournament.id,
                categoryId: category.id,
                groupId: group.id,
                firstName,
                lastName,
                email: user.email,
                acceptedAt: new Date(),
              },
            })
            playerIds.push(player.id)
            playerCount++
          }

          const captain = userByEmail.get(captainEmail)!
          const partner = userByEmail.get(partnerEmail)!
          const base = `${personSlugPart(captain)}-${personSlugPart(partner)}`
          let pairSlug = base
          for (let n = 1; takenPairSlugs.has(pairSlug); n++) pairSlug = `${base}-${n}`
          if (pairSlug !== base) warnings.push(`Slug de pareja con sufijo: ${pairSlug} (${captainEmail} / ${partnerEmail})`)
          takenPairSlugs.add(pairSlug)

          await tx.doublesPair.create({
            data: {
              categoryId: category.id,
              captainPlayerId: playerIds[0],
              partnerPlayerId: playerIds[1],
              slug: pairSlug,
            },
          })
          pairsOut.push({ group: g.name, slug: pairSlug, captain: captainEmail, partner: partnerEmail })
          captainUserIds.push(captain.id)
        }

        const start = parseFromUY(date, g.startTime)
        for (const [round, matches] of ROUND_ROBIN.entries()) {
          for (const [ci, [a, b]] of matches.entries()) {
            await tx.match.create({
              data: {
                tournamentId: tournament.id,
                categoryId: category.id,
                groupId: group.id,
                stage: 'GROUP',
                status: 'CONFIRMED',
                player1Id: captainUserIds[a],
                player2Id: captainUserIds[b],
                courtNumber: courts[ci],
                scheduledAt: addMinutes(start, round * input.matchMinutes),
                externalCourt: false,
                selfScheduled: false,
                confirmedAt: new Date(),
              },
            })
            groupMatchCount++
          }
        }
      }

      // Definición. Posición 1 de grupo solo alimenta llaves de oro, posición 2 solo de plata
      // (invariante de refreshBracketSlotsFromGroup).
      const [gA, gB, gC, gD] = groupIds
      const bracket: {
        cup: Cup
        stage: MatchStage
        bracketPosition: number
        time: string
        court: number
        sources?: [string, string]
      }[] = [
        { cup: 'GOLD', stage: 'SEMIFINAL', bracketPosition: 1, time: semis[0], court: courts[0], sources: [gA, gB] },
        { cup: 'SILVER', stage: 'SEMIFINAL', bracketPosition: 1, time: semis[0], court: courts[1], sources: [gA, gB] },
        { cup: 'GOLD', stage: 'SEMIFINAL', bracketPosition: 2, time: semis[1], court: courts[0], sources: [gC, gD] },
        { cup: 'SILVER', stage: 'SEMIFINAL', bracketPosition: 2, time: semis[1], court: courts[1], sources: [gC, gD] },
        { cup: 'GOLD', stage: 'FINAL', bracketPosition: 1, time: final, court: courts[0] },
        { cup: 'SILVER', stage: 'FINAL', bracketPosition: 1, time: final, court: courts[1] },
      ]
      for (const m of bracket) {
        const position = m.cup === 'GOLD' ? 1 : 2
        await tx.match.create({
          data: {
            tournamentId: tournament.id,
            categoryId: category.id,
            stage: m.stage,
            cup: m.cup,
            bracketPosition: m.bracketPosition,
            // Ya tienen hora y cancha: confirmadas desde el principio, sin jugadores.
            // La propagación del cuadro llena los lados y la carga de resultado solo
            // exige CONFIRMED + los dos lados.
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            courtNumber: m.court,
            scheduledAt: parseFromUY(date, m.time),
            ...(m.sources && {
              player1SourceGroupId: m.sources[0],
              player1SourcePosition: position,
              player2SourceGroupId: m.sources[1],
              player2SourcePosition: position,
            }),
          },
        })
      }

      if (suffixedPlayerSlugs.length > 0) {
        warnings.push(
          `${suffixedPlayerSlugs.length} slug(s) de jugador con sufijo (la persona ya tenía ficha en otro torneo): ${suffixedPlayerSlugs.join(', ')}`,
        )
      }

      return { tournament, playerCount, pairsOut, groupMatchCount, bracketCount: bracket.length }
    },
    { timeout: 120_000, maxWait: 20_000 },
  )

  // ---- 3. Resumen ----
  console.log(`\n=== ${existing ? 'Torneo recargado (--reset)' : 'Torneo creado'} ===`)
  console.log(`Torneo: ${summary.tournament.name} (slug: ${summary.tournament.slug}, id: ${summary.tournament.id})`)
  console.log(`Fecha: ${date} · modality=DOUBLES · matchFormat=SHORT_SET_4 · isActive=false · featuredOnHome=${existing?.featuredOnHome ?? false}`)
  console.log(`Categoría: ${CATEGORY_NAME} · ${GROUPS} grupos`)
  console.log(`Jugadores: ${summary.playerCount}`)
  console.log(`Parejas: ${summary.pairsOut.length}`)
  for (const p of summary.pairsOut) console.log(`  [${p.group}] ${p.slug}  (${p.captain} / ${p.partner})`)
  console.log(`Partidos: ${summary.groupMatchCount} de grupo + ${summary.bracketCount} de Definición`)
  if (warnings.length > 0) {
    console.log(`\nAdvertencias (${warnings.length}):`)
    for (const w of warnings) console.log(`  - ${w}`)
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
