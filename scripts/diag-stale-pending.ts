// Diagnóstico READ-ONLY: partidos de escalera PENDING sin reserva que el cron
// diario (processStalePendingMatches) debería avisar/auto-cancelar.
//
// El plazo sale de `scheduleDeadlineAt` (no de createdAt): mientras una reserva espera
// al admin está en pausa, y nada se cancela sin un `scheduleWarnedAt` de un día
// anterior. Para el panorama completo —incluidas las reservas sin resolver— usar
// scripts/diag-retos-vencidos.ts.
//
// No escribe nada ni manda emails. Uso: TZ=UTC pnpm exec tsx scripts/diag-stale-pending.ts
process.env.TZ = 'UTC'

import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { differenceInCalendarDays, startOfDay } from 'date-fns'
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
  console.log(`matchScheduleDeadlineDays = ${deadline}  (vencido + avisado ayer o antes → cancelar · ≤1d o vencido sin aviso → avisar)\n`)

  // Misma selección que el cron: PENDING + sin reserva.
  const matches = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: 'PENDING', reservation: { is: null } },
    select: {
      id: true,
      createdAt: true,
      scheduleDeadlineAt: true,
      scheduleWarnedAt: true,
      player1: { select: { firstName: true, lastName: true } },
      player2: { select: { firstName: true, lastName: true } },
    },
    orderBy: { scheduleDeadlineAt: 'asc' },
  })

  if (matches.length === 0) {
    console.log('No hay partidos PENDING sin reserva. Nada colgado. ✅')
  } else {
    const now = new Date()
    const nowUY = toZonedTime(now, TIMEZONE)
    const startOfTodayUY = startOfDay(nowUY)
    let toCancel = 0
    let toWarn = 0
    let withinWindow = 0
    let noDeadline = 0
    console.log('vence (UY)           díasRest  acción                     jugadores')
    console.log('─'.repeat(96))
    for (const m of matches) {
      const dl = m.scheduleDeadlineAt
      let action: string
      let daysLeft: number | null = null
      if (dl == null) {
        // Legacy / torneo: sin plazo el cron no lo mira nunca.
        action = '· sin plazo (intocable)'; noDeadline++
      } else {
        daysLeft = differenceInCalendarDays(toZonedTime(dl, TIMEZONE), nowUY)
        const warnedBeforeToday =
          m.scheduleWarnedAt != null && toZonedTime(m.scheduleWarnedAt, TIMEZONE) < startOfTodayUY
        if (dl < now && warnedBeforeToday) { action = '🔴 auto-cancelar'; toCancel++ }
        else if (dl < now && m.scheduleWarnedAt == null) { action = '🟡 avisar (vencido)'; toWarn++ }
        else if (dl >= now && daysLeft <= 1 && m.scheduleWarnedAt == null) { action = '🟡 avisar (último día)'; toWarn++ }
        else { action = '· dentro de ventana'; withinWindow++ }
      }
      const venc = dl ? toZonedTime(dl, TIMEZONE).toISOString().slice(0, 16).replace('T', ' ') : '—'
      console.log(`${venc.padEnd(20)} ${String(daysLeft ?? '—').padStart(6)}   ${action.padEnd(25)} ${name(m.player1)} vs ${name(m.player2)}`)
    }
    console.log('\n' + '─'.repeat(60))
    console.log(`Total PENDING sin reserva: ${matches.length}`)
    console.log(`  🔴 se auto-cancelarían: ${toCancel}`)
    console.log(`  🟡 recibirían aviso:    ${toWarn}`)
    console.log(`  ·  aún en ventana:      ${withinWindow}`)
    if (noDeadline > 0) console.log(`  ·  sin plazo (legacy):  ${noDeadline}`)
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
