// Diagnóstico READ-ONLY: partidos de escalera PENDING sin reserva que el cron
// diario (processStalePendingMatches) debería haber avisado/auto-cancelado.
// No escribe nada ni manda emails. Uso: TZ=UTC pnpm exec tsx scripts/diag-stale-pending.ts
process.env.TZ = 'UTC'

import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { differenceInCalendarDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const TIMEZONE = 'America/Montevideo'
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL })

const name = (u: { firstName: string | null; lastName: string | null } | null) =>
  `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || '(?)'

async function main() {
  const ladder = await prisma.ladder.findFirst({ where: { isActive: true } })
  if (!ladder) return console.log('No hay escalera activa.')

  const deadline = ladder.matchScheduleDeadlineDays
  console.log(`\n=== Partidos PENDING sin reserva — ${ladder.name} ===`)
  console.log(`matchScheduleDeadlineDays = ${deadline}  (≥ ${deadline}d → auto-cancelar · ${deadline - 1}d → avisar)\n`)

  // Misma selección que el cron: PENDING + sin reserva.
  const matches = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: 'PENDING', reservation: { is: null } },
    select: {
      id: true,
      createdAt: true,
      player1: { select: { firstName: true, lastName: true } },
      player2: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (matches.length === 0) {
    console.log('No hay partidos PENDING sin reserva. Nada colgado. ✅')
  } else {
    const nowUY = toZonedTime(new Date(), TIMEZONE)
    let toCancel = 0
    let toWarn = 0
    let withinWindow = 0
    console.log('creado (UY)          díasAtrás  acción                    jugadores')
    console.log('─'.repeat(92))
    for (const m of matches) {
      const daysSince = differenceInCalendarDays(nowUY, toZonedTime(m.createdAt, TIMEZONE))
      let action: string
      if (daysSince >= deadline) { action = '🔴 auto-cancelar'; toCancel++ }
      else if (daysSince === deadline - 1) { action = '🟡 avisar (1 día)'; toWarn++ }
      else { action = '· dentro de ventana'; withinWindow++ }
      const created = toZonedTime(m.createdAt, TIMEZONE).toISOString().slice(0, 16).replace('T', ' ')
      console.log(`${created}  ${String(daysSince).padStart(6)}   ${action.padEnd(24)} ${name(m.player1)} vs ${name(m.player2)}`)
    }
    console.log('\n' + '─'.repeat(60))
    console.log(`Total PENDING sin reserva: ${matches.length}`)
    console.log(`  🔴 se auto-cancelarían: ${toCancel}`)
    console.log(`  🟡 recibirían aviso:    ${toWarn}`)
    console.log(`  ·  aún en ventana:      ${withinWindow}`)
  }

  // Confirmación de que la expiración perezosa cubrió los retos vencidos:
  // PROPOSED con respondByAt ya pasado que NO fueron marcados EXPIRED.
  const staleProposed = await prisma.challenge.count({
    where: { ladderId: ladder.id, status: 'PROPOSED', respondByAt: { lt: new Date() } },
  })
  console.log(`\nRetos PROPOSED vencidos aún sin marcar EXPIRED (debería ser ~0): ${staleProposed}`)
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
