// Crea directo en la base un partido de escalera YA JUGADO, con todo lo que la app
// deja al terminar el ciclo normal (reto → aceptar → agendar → cargar resultado):
//
//   Challenge ACCEPTED  →  Match PLAYED  →  MatchResult  →  Elo (2 LadderMember + 2 RatingHistory)
//
// Sirve para el caso que la app no permite: dos jugadores que ya tienen un reto vivo
// entre sí (hasActiveChallengeBetween) y juegan OTRO partido. No toca el partido ni el
// reto existentes. No manda emails ni publica nada.
//
// Solo formato SINGLE_SET (el de La Escalera). El Elo replica applyMatchElo
// (src/services/ladder-elo-service.ts) con la misma fórmula pura de src/lib/elo.ts.
//
// Base destino: TARGET_DATABASE_URL si está definida; si no, DIRECT_DATABASE_URL de
// .env.local. SIEMPRE confirmá el host que imprime "BD destino" antes de --apply.
//
// Seguridad:
//  - DRY-RUN por defecto: valida todo y muestra lo que crearía. Escribe solo con --apply.
//  - Todo en una transacción; antes de commitear se re-lee y se verifica la consistencia.
//  - Se niega a duplicar: si ya hay un partido jugado entre ambos ese mismo día UY, corta.
//
// Uso (jugadores por email, o por texto que matchee nombre/apellido de un único usuario):
//   TZ=UTC pnpm exec tsx scripts/crear-partido-escalera.ts \
//     --retador "Carvalho" --retado "Camou" --score 6-4 --ganador retador \
//     --fecha "2026-11-20 16:00" --cancha 2 [--tb 7-5] [--reporta retador] [--apply]
//
//   --score    games del retador-retado (el retador es player1, como en la app)
//   --ganador  retador | retado (tiene que coincidir con el score; es un doble chequeo)
//   --fecha    hora UY del partido ("YYYY-MM-DD HH:mm"), en el pasado
//   --cancha   número de cancha del club, o "externa"
//   --tb       tiebreak retador-retado, obligatorio solo si el set fue 7-6
//   --reporta  retador | retado: quién figura cargando el resultado (default: el ganador)
process.env.TZ = 'UTC'

import { config } from 'dotenv'
config({ path: '.env.local', override: false })

import { PrismaClient, type Prisma } from '@prisma/client'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { eloWinnerDelta } from '../src/lib/elo'

const TIMEZONE = 'America/Montevideo'
const APPLY = process.argv.includes('--apply')

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
function fail(msg: string): never {
  console.error(`❌ ${msg}`)
  process.exit(1)
}
function required(name: string): string {
  const v = arg(name)
  if (!v || v.startsWith('--')) fail(`Falta --${name}`)
  return v
}
function pair(name: string, raw: string): [number, number] {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(raw)
  if (!m) fail(`--${name} tiene que ser N-N (recibí "${raw}")`)
  return [Number(m[1]), Number(m[2])]
}
function side(name: string, raw: string): 'retador' | 'retado' {
  if (raw !== 'retador' && raw !== 'retado') fail(`--${name} tiene que ser "retador" o "retado"`)
  return raw
}

// --- Args ---------------------------------------------------------------------------
const challengerQuery = required('retador')
const challengedQuery = required('retado')
const [g1, g2] = pair('score', required('score'))
const winnerSide = side('ganador', required('ganador'))
const reporterSide = side('reporta', arg('reporta') ?? winnerSide)
const tbRaw = arg('tb')
const courtRaw = required('cancha')
const fechaRaw = required('fecha')

// Mismas reglas que singleSetSchema (src/lib/validations/match-result.ts).
const validSet =
  (g1 === 6 && g2 <= 4) || (g2 === 6 && g1 <= 4) ||
  (g1 === 7 && (g2 === 5 || g2 === 6)) || (g2 === 7 && (g1 === 5 || g1 === 6))
if (!validSet) fail(`Score de set inválido: ${g1}-${g2}`)
if ((g1 > g2 ? 'retador' : 'retado') !== winnerSide) {
  fail(`El score ${g1}-${g2} (retador-retado) no coincide con --ganador ${winnerSide}`)
}
const isTbSet = (g1 === 7 && g2 === 6) || (g1 === 6 && g2 === 7)
let tb: [number, number] | null = null
if (isTbSet) {
  if (!tbRaw) fail('Set 7-6: falta --tb')
  tb = pair('tb', tbRaw)
  const hi = Math.max(...tb), lo = Math.min(...tb)
  if (hi < 7 || hi - lo < 2) fail('Tiebreak inválido (mínimo 7 puntos, diferencia de 2)')
  if (tb[0] > tb[1] !== g1 > g2) fail('El ganador del tiebreak no coincide con el ganador del set')
} else if (tbRaw) {
  fail('--tb solo corresponde si el set fue 7-6')
}

const externalCourt = courtRaw === 'externa'
const courtNumber = externalCourt ? null : Number(courtRaw)
if (!externalCourt && (!Number.isInteger(courtNumber) || courtNumber! < 1)) {
  fail(`--cancha tiene que ser un número o "externa" (recibí "${courtRaw}")`)
}

if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(fechaRaw)) fail('--fecha tiene que ser "YYYY-MM-DD HH:mm" (hora UY)')
const scheduledAt = fromZonedTime(fechaRaw.replace(' ', 'T') + ':00', TIMEZONE)
if (Number.isNaN(scheduledAt.getTime())) fail(`--fecha inválida: "${fechaRaw}"`)
const now = new Date()
if (scheduledAt > now) fail('--fecha está en el futuro: este script solo carga partidos ya jugados')

// --- BD -----------------------------------------------------------------------------
const url = process.env.TARGET_DATABASE_URL ?? process.env.DIRECT_DATABASE_URL
if (!url) fail('Falta TARGET_DATABASE_URL (o DIRECT_DATABASE_URL en .env.local).')
if (url.startsWith('prisma://')) fail('La URL es Accelerate (prisma://). Necesito el postgres directo.')
const host = (() => { try { return new URL(url).host } catch { return '(host desconocido)' } })()
const prisma = new PrismaClient({ datasourceUrl: url })

const uy = (d: Date) => formatInTimeZone(d, TIMEZONE, 'yyyy-MM-dd HH:mm')
const fullName = (u: { firstName: string | null; lastName: string | null }) =>
  `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '(?)'

async function findUser(query: string, label: string) {
  const q = query.trim()
  const select = { id: true, firstName: true, lastName: true, email: true, isActive: true } as const
  const users = q.includes('@')
    ? await prisma.user.findMany({ where: { email: { equals: q, mode: 'insensitive' } }, select })
    : await prisma.user.findMany({
        where: {
          AND: q.split(/\s+/).map((w) => ({
            OR: [
              { firstName: { contains: w, mode: 'insensitive' as const } },
              { lastName: { contains: w, mode: 'insensitive' as const } },
            ],
          })),
        },
        select,
      })
  if (users.length === 0) fail(`${label}: no encontré ningún usuario para "${query}"`)
  if (users.length > 1) {
    fail(`${label}: "${query}" matchea ${users.length} usuarios (${users.map((u) => `${fullName(u)} <${u.email}>`).join(', ')}). Usá el email.`)
  }
  if (!users[0].isActive) fail(`${label}: ${fullName(users[0])} está inactivo`)
  return users[0]
}

class DryRun extends Error {}

async function main() {
  console.log(`\nBD destino: ${host}`)
  console.log(`Modo: ${APPLY ? '⚠️  APPLY — VA A ESCRIBIR' : 'DRY-RUN (no modifica nada)'}\n`)

  const ladder = await prisma.ladder.findFirst({ where: { isActive: true } })
  if (!ladder) fail('No hay escalera activa.')
  if (ladder.matchFormat !== 'SINGLE_SET') fail(`La escalera usa ${ladder.matchFormat}; este script solo soporta SINGLE_SET.`)

  const challenger = await findUser(challengerQuery, 'Retador')
  const challenged = await findUser(challengedQuery, 'Retado')
  if (challenger.id === challenged.id) fail('Retador y retado son el mismo usuario.')
  const winner = winnerSide === 'retador' ? challenger : challenged
  const loser = winnerSide === 'retador' ? challenged : challenger
  const reporter = reporterSide === 'retador' ? challenger : challenged

  // Duplicado: mismo par, ya jugado, mismo día UY que --fecha.
  const dayStart = fromZonedTime(fechaRaw.slice(0, 10) + 'T00:00:00', TIMEZONE)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  const pairWhere: Prisma.MatchWhereInput = {
    ladderId: ladder.id,
    OR: [
      { player1Id: challenger.id, player2Id: challenged.id },
      { player1Id: challenged.id, player2Id: challenger.id },
    ],
  }
  const dup = await prisma.match.findFirst({
    where: { ...pairWhere, status: 'PLAYED', scheduledAt: { gte: dayStart, lt: dayEnd } },
    select: { id: true, scheduledAt: true },
  })
  if (dup) fail(`Ya hay un partido jugado entre ambos ese día (${dup.id}, ${uy(dup.scheduledAt!)}). No duplico.`)

  // Cancha del club ocupada en ese horario por otro partido o reserva: no pisar.
  if (!externalCourt) {
    const [busyMatch, busyRes] = await Promise.all([
      prisma.match.findFirst({
        where: { scheduledAt, courtNumber, status: { in: ['CONFIRMED', 'PLAYED'] } },
        select: { id: true },
      }),
      prisma.slotReservation.findFirst({ where: { scheduledAt, courtNumber: courtNumber! }, select: { matchId: true } }),
    ])
    if (busyMatch || busyRes) {
      fail(`La cancha ${courtNumber} ya figura ocupada el ${uy(scheduledAt)} (partido ${busyMatch?.id ?? busyRes?.matchId}). Revisá --fecha/--cancha.`)
    }
  }

  const others = await prisma.match.findMany({
    where: { ...pairWhere, status: { in: ['PENDING', 'CONFIRMED'] } },
    select: { id: true, status: true, scheduledAt: true },
  })

  try {
    await prisma.$transaction(async (tx) => {
      const [wm, lm] = await Promise.all([
        tx.ladderMember.findUnique({ where: { ladderId_userId: { ladderId: ladder.id, userId: winner.id } } }),
        tx.ladderMember.findUnique({ where: { ladderId_userId: { ladderId: ladder.id, userId: loser.id } } }),
      ])
      if (!wm || !wm.isActive) throw new Error(`${fullName(winner)} no es miembro activo de la escalera`)
      if (!lm || !lm.isActive) throw new Error(`${fullName(loser)} no es miembro activo de la escalera`)

      const delta = eloWinnerDelta(ladder.kFactor, wm.rating, lm.rating)

      console.log(`Escalera:  ${ladder.name} (K=${ladder.kFactor})`)
      console.log(`Retador:   ${fullName(challenger)}  (player1)`)
      console.log(`Retado:    ${fullName(challenged)}  (player2)`)
      console.log(`Jugado:    ${uy(scheduledAt)} UY · ${externalCourt ? 'cancha externa' : `Cancha ${courtNumber}`}`)
      console.log(`Resultado: ${g1}-${g2}${tb ? ` (${tb[0]}-${tb[1]})` : ''} → gana ${fullName(winner)} · reporta ${fullName(reporter)}`)
      console.log(`Elo:       ${fullName(winner)} ${wm.rating} → ${wm.rating + delta} (+${delta})`)
      console.log(`           ${fullName(loser)} ${lm.rating} → ${lm.rating - delta} (-${delta})`)
      for (const o of others) {
        console.log(`No se toca: partido ${o.status} ${o.id}${o.scheduledAt ? ` (${uy(o.scheduledAt)} UY)` : ''}`)
      }

      // Mismo orden temporal que el ciclo real: propuesto ≤ aceptado ≤ jugado ≤ cargado.
      const match = await tx.match.create({
        data: {
          ladderId: ladder.id,
          player1Id: challenger.id,
          player2Id: challenged.id,
          status: 'PLAYED',
          scheduledAt,
          courtNumber,
          externalCourt,
          selfScheduled: false,
          confirmedAt: scheduledAt,
          playedAt: now,
          createdAt: scheduledAt,
        },
      })
      const challenge = await tx.challenge.create({
        data: {
          ladderId: ladder.id,
          challengerId: challenger.id,
          challengedId: challenged.id,
          status: 'ACCEPTED',
          proposedAt: scheduledAt,
          respondByAt: scheduledAt,
          respondedAt: scheduledAt,
          matchId: match.id,
          createdAt: scheduledAt,
        },
      })
      await tx.matchResult.create({
        data: {
          matchId: match.id,
          reportedById: reporter.id,
          set1Player1: g1,
          set1Player2: g2,
          tb1Player1: tb?.[0] ?? null,
          tb1Player2: tb?.[1] ?? null,
          walkover: false,
          winnerId: winner.id,
        },
      })
      await tx.ladderMember.update({ where: { id: wm.id }, data: { rating: wm.rating + delta } })
      await tx.ladderMember.update({ where: { id: lm.id }, data: { rating: lm.rating - delta } })
      await tx.ratingHistory.createMany({
        data: [
          { ladderMemberId: wm.id, reason: 'MATCH', matchId: match.id, ratingBefore: wm.rating, ratingAfter: wm.rating + delta, delta },
          { ladderMemberId: lm.id, reason: 'MATCH', matchId: match.id, ratingBefore: lm.rating, ratingAfter: lm.rating - delta, delta: -delta },
        ],
      })

      // --- Verificación dentro de la transacción (si algo no cierra, rollback) ---
      const check = await tx.match.findUniqueOrThrow({
        where: { id: match.id },
        include: { result: true, challenge: true, reservation: true, ratingHistory: { include: { member: true } } },
      })
      const problems: string[] = []
      const expect = (ok: boolean, msg: string) => { if (!ok) problems.push(msg) }
      expect(check.status === 'PLAYED' && check.playedAt != null && check.scheduledAt != null, 'partido no quedó PLAYED con fechas')
      expect(check.tournamentId == null && check.categoryId == null && check.ladderId === ladder.id, 'partido no es solo de escalera')
      expect(!check.externalCourt || check.courtNumber == null, 'externalCourt con courtNumber')
      expect(check.reservation == null, 'quedó una reserva colgada')
      expect(check.challenge?.id === challenge.id && check.challenge.status === 'ACCEPTED', 'reto no quedó ACCEPTED y vinculado')
      expect(check.challenge?.challengerId === check.player1Id && check.challenge?.challengedId === check.player2Id, 'retador/retado no coinciden con player1/player2')
      expect(check.result?.winnerId === winner.id, 'ganador del resultado incorrecto')
      expect((check.result!.set1Player1 > check.result!.set1Player2 ? check.player1Id : check.player2Id) === check.result!.winnerId, 'score y ganador no coinciden')
      expect(check.ratingHistory.length === 2, `historial de rating: ${check.ratingHistory.length} filas (esperaba 2)`)
      expect(check.ratingHistory.reduce((s, r) => s + r.delta, 0) === 0, 'Elo no es suma-cero')
      for (const r of check.ratingHistory) {
        expect(r.ratingAfter === r.ratingBefore + r.delta, `historial ${r.id}: after ≠ before + delta`)
        expect(r.member.rating === r.ratingAfter, `rating actual de ${r.member.userId} ≠ ratingAfter`)
      }
      // El último movimiento de cada miembro tiene que explicar su rating actual.
      for (const m of [wm, lm]) {
        const last = await tx.ratingHistory.findFirst({ where: { ladderMemberId: m.id }, orderBy: { createdAt: 'desc' } })
        expect(last?.matchId === match.id, `el último historial de ${m.userId} no es este partido`)
      }
      if (problems.length > 0) throw new Error(`Verificación falló:\n  - ${problems.join('\n  - ')}`)

      console.log(`\nVerificación OK (partido, reto, resultado, Elo suma-cero, historial).`)
      if (!APPLY) throw new DryRun()
      console.log(`\n✅ Creado. Partido ${match.id} · Reto ${challenge.id}`)
    }, { maxWait: 10_000, timeout: 20_000 })
  } catch (e) {
    if (e instanceof DryRun) {
      console.log('\nDRY-RUN: se hizo rollback, no se modificó nada. Re-corré con --apply para crear.')
      return
    }
    throw e
  }
}

main()
  .catch((e) => { console.error('Error:', e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
