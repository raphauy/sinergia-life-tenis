// Diagnóstico READ-ONLY: ¿por qué se vencen partidos que ya tenían reserva pedida?
// Busca (a) reservas zombie (slot ya pasado, match sigue PENDING), (b) partidos de
// escalera CANCELLED de retos ACCEPTED, con la hora de cancelación (para distinguir
// cron ~01:00 UY vs. cancelación manual), (c) pares que volvieron a retarse después.
// No escribe nada. Uso: TZ=UTC pnpm exec tsx scripts/diag-retos-vencidos.ts
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
const uy = (d: Date) => toZonedTime(d, TIMEZONE).toISOString().slice(0, 16).replace('T', ' ')

async function main() {
  const ladder = await prisma.ladder.findFirst({ where: { isActive: true } })
  if (!ladder) return console.log('No hay escalera activa.')
  const deadline = ladder.matchScheduleDeadlineDays
  const nowUY = toZonedTime(new Date(), TIMEZONE)
  console.log(`\n=== ${ladder.name} · deadline=${deadline}d · leadDays=${ladder.reservationLeadDays} ===\n`)

  // (a) Reservas sin resolver: el partido sigue PENDING y su plazo está en pausa.
  // Las que tienen el turno ya pasado las libera el cron (y da plazo nuevo).
  const reservations = await prisma.slotReservation.findMany({
    where: { match: { ladderId: ladder.id, status: 'PENDING' } },
    select: {
      scheduledAt: true,
      createdAt: true,
      match: {
        select: {
          id: true,
          createdAt: true,
          scheduleDeadlineAt: true,
          player1: { select: { firstName: true, lastName: true } },
          player2: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { scheduledAt: 'asc' },
  })
  const zombies = reservations.filter((r) => r.scheduledAt < new Date())
  console.log(`--- (a) Reservas pedidas y NUNCA resueltas por el admin: ${reservations.length}`)
  console.log(`    de esas, con el turno ya vencido (las limpia el cron): ${zombies.length}\n`)
  for (const r of reservations) {
    const daysSince = differenceInCalendarDays(nowUY, toZonedTime(r.match.createdAt, TIMEZONE))
    const flag = r.scheduledAt < new Date() ? '🧟 turno vencido' : '⏳ por venir'
    console.log(
      `    ${flag}  turno ${uy(r.scheduledAt)}  · reto aceptado ${uy(r.match.createdAt)} (hace ${daysSince}d)` +
        `  · plazo ${r.match.scheduleDeadlineAt ? uy(r.match.scheduleDeadlineAt) : '—'} (en pausa)` +
        `  · ${name(r.match.player1)} vs ${name(r.match.player2)}`
    )
  }

  // (a2) Partidos a coordinar sin reserva: cuánto plazo les queda y si ya se les avisó.
  const openMatches = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: 'PENDING', reservation: { is: null } },
    select: {
      createdAt: true,
      scheduleDeadlineAt: true,
      scheduleWarnedAt: true,
      player1: { select: { firstName: true, lastName: true } },
      player2: { select: { firstName: true, lastName: true } },
    },
    orderBy: { scheduleDeadlineAt: 'asc' },
  })
  console.log(`\n--- (a2) Partidos a coordinar SIN reserva: ${openMatches.length}\n`)
  for (const m of openMatches) {
    const left = m.scheduleDeadlineAt
      ? differenceInCalendarDays(toZonedTime(m.scheduleDeadlineAt, TIMEZONE), nowUY)
      : null
    const estado =
      m.scheduleDeadlineAt == null
        ? '· sin plazo (legacy: el cron no lo toca)'
        : left != null && left < 0
          ? m.scheduleWarnedAt
            ? '🔴 vencido y avisado → se cancela en la próxima corrida'
            : '🟡 vencido sin avisar → primero recibe el aviso'
          : m.scheduleWarnedAt
            ? `· quedan ${left}d (ya avisado)`
            : `· quedan ${left}d`
    console.log(
      `    plazo ${m.scheduleDeadlineAt ? uy(m.scheduleDeadlineAt) : '—'}  ${estado.padEnd(46)} ${name(m.player1)} vs ${name(m.player2)}`
    )
  }

  // (b) Partidos de escalera cancelados que venían de un reto ACCEPTED.
  const cancelled = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: 'CANCELLED', challenge: { isNot: null } },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      player1Id: true,
      player2Id: true,
      player1: { select: { firstName: true, lastName: true } },
      player2: { select: { firstName: true, lastName: true } },
      challenge: { select: { status: true, proposedAt: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 40,
  })
  console.log(`\n--- (b) Partidos de escalera CANCELLED con reto detrás: ${cancelled.length} (últimos 40)\n`)
  console.log('    cancelado (UY)     hUY  díasVivo  origen              jugadores')
  console.log('    ' + '─'.repeat(88))
  for (const m of cancelled) {
    const hUY = toZonedTime(m.updatedAt, TIMEZONE).getHours()
    const days = differenceInCalendarDays(toZonedTime(m.updatedAt, TIMEZONE), toZonedTime(m.createdAt, TIMEZONE))
    // El cron corre 04:00 UTC = 01:00 UY. Hora 1 ⇒ casi seguro cron.
    const origen = hUY === 1 ? '🤖 cron (auto)' : '👤 manual'
    console.log(
      `    ${uy(m.updatedAt)}  ${String(hUY).padStart(3)}  ${String(days).padStart(7)}   ${origen.padEnd(18)} ${name(m.player1)} vs ${name(m.player2)}`
    )
  }

  // (c) Pares que volvieron a retarse después de que se les cancelara el partido.
  console.log(`\n--- (c) Pares que se volvieron a retar tras la cancelación\n`)
  for (const m of cancelled) {
    if (!m.player1Id || !m.player2Id) continue
    const again = await prisma.challenge.findFirst({
      where: {
        ladderId: ladder.id,
        proposedAt: { gt: m.updatedAt },
        OR: [
          { challengerId: m.player1Id, challengedId: m.player2Id },
          { challengerId: m.player2Id, challengedId: m.player1Id },
        ],
      },
      select: { proposedAt: true, status: true },
      orderBy: { proposedAt: 'asc' },
    })
    if (again) {
      const gapH = Math.round((again.proposedAt.getTime() - m.updatedAt.getTime()) / 3_600_000)
      console.log(
        `    ${name(m.player1)} vs ${name(m.player2)}: cancelado ${uy(m.updatedAt)} → re-retado ${uy(again.proposedAt)} (+${gapH}h, ${again.status})`
      )
    }
  }

  // (d) Resumen: cuántos murieron por el cron y cuántos de esos sólo se explican si
  // tenían una reserva viva que después desapareció (vivieron más que el deadline:
  // un PENDING sin reserva nunca llega a superarlo, el cron lo mata antes).
  const allCancelled = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: 'CANCELLED', challenge: { isNot: null } },
    select: { createdAt: true, updatedAt: true },
  })
  const byCron = allCancelled.filter((m) => toZonedTime(m.updatedAt, TIMEZONE).getHours() === 1)
  const overdue = byCron.filter(
    (m) => differenceInCalendarDays(toZonedTime(m.updatedAt, TIMEZONE), toZonedTime(m.createdAt, TIMEZONE)) > deadline
  )
  const [totalCh, acceptedCh, playedM] = await Promise.all([
    prisma.challenge.count({ where: { ladderId: ladder.id } }),
    prisma.challenge.count({ where: { ladderId: ladder.id, status: 'ACCEPTED' } }),
    prisma.match.count({ where: { ladderId: ladder.id, status: 'PLAYED' } }),
  ])
  console.log(`\n--- (d) Resumen\n`)
  console.log(`    ${totalCh} retos · ${acceptedCh} aceptados · ${playedM} jugados · ${allCancelled.length} partidos muertos`)
  console.log(`    auto-cancelados por el cron: ${byCron.length} · a mano: ${allCancelled.length - byCron.length}`)
  console.log(`    del cron, vivieron más de ${deadline}d (tenían reserva y la perdieron): ${overdue.length}`)
  console.log(`    tasa de retos aceptados que terminan en partido muerto: ${Math.round((allCancelled.length / acceptedCh) * 100)}%\n`)
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
