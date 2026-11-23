// Sube al piso de la escalera (ratingFloor) a un miembro que quedó por debajo por
// perder partidos ANTES de que existiera la regla "nadie baja del piso por perder".
//
// No agrega un ajuste: reescribe su historial como si la regla hubiera estado vigente.
// Recorre sus RatingHistory en orden y recorta cada pérdida de partido (MATCH con delta
// negativo) a lo que le quedaba hasta el piso; las demás filas conservan su delta. Los
// rivales no se tocan (el ganador ya cobró su delta entero).
//
// Base destino: TARGET_DATABASE_URL si está definida; si no, DIRECT_DATABASE_URL de
// .env.local. SIEMPRE confirmá el host que imprime "BD destino" antes de --apply.
// DRY-RUN por defecto; escribe solo con --apply (una transacción).
//
// Uso (email, o texto que matchee nombre/apellido de un único usuario):
//   TZ=UTC pnpm exec tsx scripts/subir-al-piso.ts --jugador "Juan Pablo Silva" [--apply]
process.env.TZ = 'UTC'

import { config } from 'dotenv'
config({ path: '.env.local', override: false })

import { PrismaClient } from '@prisma/client'

const APPLY = process.argv.includes('--apply')
function fail(msg: string): never {
  console.error(`❌ ${msg}`)
  process.exit(1)
}
const qi = process.argv.indexOf('--jugador')
const query = qi >= 0 ? process.argv[qi + 1] : undefined
if (!query || query.startsWith('--')) fail('Falta --jugador')

const url = process.env.TARGET_DATABASE_URL ?? process.env.DIRECT_DATABASE_URL
if (!url) fail('Falta TARGET_DATABASE_URL (o DIRECT_DATABASE_URL en .env.local).')
if (url.startsWith('prisma://')) fail('La URL es Accelerate (prisma://). Necesito el postgres directo.')
const host = (() => { try { return new URL(url).host } catch { return '(host desconocido)' } })()
const prisma = new PrismaClient({ datasourceUrl: url })

async function main() {
  console.log(`\nBD destino: ${host}`)
  console.log(`Modo: ${APPLY ? '⚠️  APPLY — VA A ESCRIBIR' : 'DRY-RUN (no modifica nada)'}\n`)

  const ladder = await prisma.ladder.findFirst({ where: { isActive: true } })
  if (!ladder) fail('No hay escalera activa.')
  const floor = ladder.ratingFloor

  const q = query!.trim()
  const users = await prisma.user.findMany({
    where: q.includes('@')
      ? { email: { equals: q, mode: 'insensitive' } }
      : {
          AND: q.split(/\s+/).map((w) => ({
            OR: [
              { firstName: { contains: w, mode: 'insensitive' as const } },
              { lastName: { contains: w, mode: 'insensitive' as const } },
            ],
          })),
        },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
  if (users.length === 0) fail(`No encontré ningún usuario para "${query}"`)
  if (users.length > 1) {
    fail(`"${query}" matchea ${users.length} usuarios (${users.map((u) => `${u.firstName} ${u.lastName} <${u.email}>`).join(', ')}). Usá el email.`)
  }
  const user = users[0]
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()

  const member = await prisma.ladderMember.findUnique({
    where: { ladderId_userId: { ladderId: ladder.id, userId: user.id } },
    include: { ratingHistory: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
  })
  if (!member) fail(`${name} no es miembro de la escalera`)
  console.log(`Jugador: ${name} · rating actual ${member.rating} · piso ${floor}`)
  if (member.rating >= floor) {
    console.log('Ya está en el piso o por encima: nada que hacer.')
    return
  }
  const rows = member.ratingHistory
  if (rows.length === 0) fail('No tiene historial de rating: no sé de dónde viene el negativo.')
  if (rows[rows.length - 1].ratingAfter !== member.rating) {
    fail(`Su último historial (${rows[rows.length - 1].ratingAfter}) no explica su rating actual (${member.rating}). Revisar a mano.`)
  }

  // Replay con piso: solo se recortan las pérdidas de partido.
  let running = rows[0].ratingBefore
  const changes: { id: string; ratingBefore: number; ratingAfter: number; delta: number }[] = []
  for (const r of rows) {
    const delta =
      r.reason === 'MATCH' && r.delta < 0 ? -Math.min(-r.delta, Math.max(0, running - floor)) + 0 : r.delta
    const after = running + delta
    const changed = r.ratingBefore !== running || r.ratingAfter !== after || r.delta !== delta
    console.log(
      `  ${r.createdAt.toISOString().slice(0, 16)} ${r.reason.padEnd(10)} ` +
        `${r.ratingBefore} → ${r.ratingAfter} (${r.delta >= 0 ? '+' : ''}${r.delta})` +
        (changed ? `   ⇒   ${running} → ${after} (${delta >= 0 ? '+' : ''}${delta})` : '')
    )
    if (changed) changes.push({ id: r.id, ratingBefore: running, ratingAfter: after, delta })
    running = after
  }
  console.log(`\nRating: ${member.rating} → ${running} · ${changes.length} fila(s) de historial a reescribir`)
  if (running < floor) fail(`Aun con el piso queda en ${running}: el negativo no viene de perder partidos. Revisar a mano.`)

  if (!APPLY) {
    console.log('\nDRY-RUN: no se modificó nada. Re-corré con --apply.')
    return
  }
  await prisma.$transaction(async (tx) => {
    // Guarda de concurrencia: si el rating cambió desde que lo leímos, no pisamos.
    const { count } = await tx.ladderMember.updateMany({
      where: { id: member.id, rating: member.rating },
      data: { rating: running },
    })
    if (count !== 1) throw new Error('El rating cambió mientras corría el script. Re-corré.')
    for (const c of changes) {
      await tx.ratingHistory.update({
        where: { id: c.id },
        data: { ratingBefore: c.ratingBefore, ratingAfter: c.ratingAfter, delta: c.delta },
      })
    }
  })
  console.log(`\n✅ ${name} quedó en ${running}.`)
}

main()
  .catch((e) => { console.error('Error:', e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
