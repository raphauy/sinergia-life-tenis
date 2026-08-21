// Cancela EN SILENCIO (sin emails) los partidos de escalera vencidos. Replica EXACTO
// la rama de auto-cancelación del cron diario (processStalePendingMatches), pero NO
// notifica a nadie.
//
// Regla (la misma del cron): sin reserva viva + `scheduleDeadlineAt` ya pasado +
// `scheduleWarnedAt` sellado en un día anterior. No alcanza con que el partido sea
// viejo: mientras una reserva espera al admin el plazo está en pausa, y nada se
// cancela sin un aviso previo. Un partido sin `scheduleDeadlineAt` (torneo o legacy)
// no vence nunca.
//
// Usa .env.local (mismo patrón que inspect-*.ts / diag-*.ts). Apuntá el
// DIRECT_DATABASE_URL de .env.local a la base que quieras: dev para probar, prod
// para ejecutar. SIEMPRE confirmá el host que imprime "BD destino" antes de --apply.
//
// Seguridad:
//  - DRY-RUN por defecto: lista lo que cancelaría y no toca nada. Cancela solo con --apply.
//  - Imprime el host de la BD antes de operar.
//
// Uso:
//   Dry-run:  TZ=UTC pnpm exec tsx scripts/cancel-stale-pending.ts
//   Aplicar:  TZ=UTC pnpm exec tsx scripts/cancel-stale-pending.ts --apply
process.env.TZ = 'UTC'

import { config } from 'dotenv'
config({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import { differenceInCalendarDays, startOfDay } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const TIMEZONE = 'America/Montevideo'
const APPLY = process.argv.includes('--apply')

const url = process.env.DIRECT_DATABASE_URL
if (!url) {
  console.error('❌ Falta DIRECT_DATABASE_URL en .env.local (postgres directo, postgres://…).')
  process.exit(1)
}
if (url.startsWith('prisma://')) {
  console.error('❌ DIRECT_DATABASE_URL es Accelerate (prisma://). Necesito el postgres directo.')
  process.exit(1)
}
const host = (() => { try { return new URL(url).host } catch { return '(host desconocido)' } })()

const prisma = new PrismaClient({ datasourceUrl: url })
const name = (u: { firstName: string | null; lastName: string | null } | null) =>
  `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || '(?)'

async function main() {
  console.log(`\nBD destino: ${host}`)
  console.log(`Modo: ${APPLY ? '⚠️  APPLY — VA A CANCELAR' : 'DRY-RUN (no modifica nada)'}\n`)

  const ladder = await prisma.ladder.findFirst({ where: { isActive: true } })
  if (!ladder) { console.log('No hay escalera activa.'); return }

  const matches = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: 'PENDING', reservation: { is: null } },
    select: {
      id: true, createdAt: true, scheduleDeadlineAt: true, scheduleWarnedAt: true,
      player1: { select: { firstName: true, lastName: true } },
      player2: { select: { firstName: true, lastName: true } },
    },
    orderBy: { scheduleDeadlineAt: 'asc' },
  })

  const now = new Date()
  const nowUY = toZonedTime(now, TIMEZONE)
  const startOfTodayUY = startOfDay(nowUY)
  const stale = matches.filter(
    (m) =>
      m.scheduleDeadlineAt != null &&
      m.scheduleDeadlineAt < now &&
      m.scheduleWarnedAt != null &&
      toZonedTime(m.scheduleWarnedAt, TIMEZONE) < startOfTodayUY
  )

  console.log(`PENDING sin reserva: ${matches.length}  ·  vencidos Y ya avisados, a cancelar: ${stale.length}\n`)
  for (const m of stale) {
    const days = differenceInCalendarDays(nowUY, toZonedTime(m.scheduleDeadlineAt!, TIMEZONE))
    const dl = toZonedTime(m.scheduleDeadlineAt!, TIMEZONE).toISOString().slice(0, 16).replace('T', ' ')
    const wr = toZonedTime(m.scheduleWarnedAt!, TIMEZONE).toISOString().slice(0, 10)
    console.log(`  venció ${dl} (hace ${days}d, avisado ${wr})  ${name(m.player1)} vs ${name(m.player2)}`)
  }

  // Los que están vencidos pero todavía no recibieron el aviso: los toma el cron
  // diario (les avisa y les corre el plazo). Este script no los cancela.
  const notWarned = matches.filter(
    (m) => m.scheduleDeadlineAt != null && m.scheduleDeadlineAt < now && m.scheduleWarnedAt == null
  )
  if (notWarned.length > 0) {
    console.log(`\n(${notWarned.length} vencidos SIN aviso previo: no se tocan — el cron les avisa primero)`)
  }

  if (stale.length === 0) { console.log('\nNada para cancelar.'); return }
  if (!APPLY) {
    console.log('\nDRY-RUN: no se modificó nada. Re-corré con --apply para cancelar (sin emails).')
    return
  }

  let cancelled = 0
  for (const m of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.slotReservation.deleteMany({ where: { matchId: m.id } })
      await tx.match.update({
        where: { id: m.id },
        data: { status: 'CANCELLED', scheduledAt: null, courtNumber: null, externalCourt: false, selfScheduled: false, confirmedAt: null },
      })
    })
    cancelled++
  }
  console.log(`\n✅ Cancelados ${cancelled} partidos (sin enviar emails). El reto queda ACCEPTED con partido CANCELLED (libera cupo).`)
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
