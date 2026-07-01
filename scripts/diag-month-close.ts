// Diagnóstico READ-ONLY del cierre mensual de La Escalera.
// Replica la decisión de closeLadderMonth (ladder-cron-service.ts) para un mes,
// SIN escribir nada ni enviar emails. Responde: ¿por qué se penalizó a N (o a 0)?
//
// Uso:  TZ=UTC pnpm exec tsx scripts/diag-month-close.ts [YEAR] [MONTH]
// Default: junio 2026 (el mes que el cron debía cerrar el 1/jul).
process.env.TZ = 'UTC' // igualar al server de Vercel (UTC) para el cálculo de rangos

import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { startOfMonth, endOfMonth, startOfDay, addDays, format } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'

const TIMEZONE = 'America/Montevideo'
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL })

// --- Réplicas exactas de la lógica del server ---------------------------------

function monthRangeUY(year: number, month: number) {
  const refDate = new Date(year, month - 1, 1)
  return {
    startUTC: fromZonedTime(startOfMonth(refDate), TIMEZONE),
    endUTC: fromZonedTime(endOfMonth(refDate), TIMEZONE),
  }
}

type PlayedRow = {
  player1Id: string | null
  player2Id: string | null
  result: { walkover: boolean; winnerId: string } | null
}
function countPlayedForMember(matches: PlayedRow[], userId: string): number {
  return matches.filter((m) => {
    const participated = m.player1Id === userId || m.player2Id === userId
    if (!participated) return false
    if (m.result?.walkover && m.result.winnerId !== userId) return false
    return true
  }).length
}

function coveredDaysInMonth(
  periods: { startDate: Date; endDate: Date | null }[],
  monthStartUTC: Date,
  monthEndUTC: Date
): number {
  const days = new Set<string>()
  for (const p of periods) {
    const startMs = Math.max(p.startDate.getTime(), monthStartUTC.getTime())
    const endMs = Math.min((p.endDate ?? monthEndUTC).getTime(), monthEndUTC.getTime())
    if (endMs < startMs) continue
    let cursor = startOfDay(toZonedTime(new Date(startMs), TIMEZONE))
    const endDayUY = startOfDay(toZonedTime(new Date(endMs), TIMEZONE))
    while (cursor <= endDayUY) {
      days.add(format(cursor, 'yyyy-MM-dd'))
      cursor = addDays(cursor, 1)
    }
  }
  return days.size
}

// --- Diagnóstico --------------------------------------------------------------

async function main() {
  const year = Number(process.argv[2] ?? 2026)
  const month = Number(process.argv[3] ?? 6)

  const ladder = await prisma.ladder.findFirst({ where: { isActive: true } })
  if (!ladder) {
    console.log('No hay escalera activa.')
    return
  }

  const { startUTC, endUTC } = monthRangeUY(year, month)
  const daysInMonth = new Date(year, month, 0).getDate()
  const half = daysInMonth / 2

  console.log(`\n=== Diagnóstico cierre ${month}/${year} — ${ladder.name} ===`)
  console.log(`Rango UY→UTC: ${startUTC.toISOString()}  →  ${endUTC.toISOString()}`)
  console.log(`Config: minMatchesPerMonth=${ladder.minMatchesPerMonth}  monthlyPenalty=${ladder.monthlyPenalty}  ratingFloor=${ladder.ratingFloor}`)

  // ¿Ya está cerrado este mes? (guard de idempotencia)
  const close = await prisma.ladderPeriodClose.findUnique({
    where: { ladderId_year_month: { ladderId: ladder.id, year, month } },
  })
  console.log(`LadderPeriodClose para ${month}/${year}: ${close ? `SÍ (closedAt ${close.closedAt.toISOString()})` : 'NO (mes abierto)'}`)

  // Partidos de escalera jugados en el mes.
  const matches = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: 'PLAYED', playedAt: { gte: startUTC, lte: endUTC } },
    select: { player1Id: true, player2Id: true, result: { select: { walkover: true, winnerId: true } } },
  })
  console.log(`Partidos de escalera PLAYED en el mes: ${matches.length}`)

  // Miembros activos.
  const members = await prisma.ladderMember.findMany({
    where: { ladderId: ladder.id, isActive: true },
    orderBy: { rating: 'desc' },
    select: {
      id: true, userId: true, rating: true, joinedAt: true,
      user: { select: { firstName: true, lastName: true } },
    },
  })

  // Protecciones que solapan el mes → exención si cubren > mitad del mes.
  const protections = await prisma.ladderProtection.findMany({
    where: { member: { ladderId: ladder.id }, startDate: { lte: endUTC }, OR: [{ endDate: null }, { endDate: { gte: startUTC } }] },
    select: { ladderMemberId: true, startDate: true, endDate: true },
  })
  const protByMember = new Map<string, { startDate: Date; endDate: Date | null }[]>()
  for (const p of protections) {
    const list = protByMember.get(p.ladderMemberId) ?? []
    list.push({ startDate: p.startDate, endDate: p.endDate })
    protByMember.set(p.ladderMemberId, list)
  }

  console.log(`Miembros activos: ${members.length}\n`)
  console.log('nombre                         rating  joinedAt(UTC)         jugó  decisión')
  console.log('─'.repeat(100))

  let wouldPenalize = 0
  const reasons = { grace: 0, protected: 0, metMin: 0, floor: 0, penalize: 0 }

  for (const m of members) {
    const name = `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim().padEnd(30)
    const joined = m.joinedAt.toISOString().slice(0, 19)
    const played = countPlayedForMember(matches, m.userId)

    const graced = m.joinedAt >= startUTC && m.joinedAt <= endUTC
    const periods = protByMember.get(m.id) ?? []
    const covered = coveredDaysInMonth(periods, startUTC, endUTC)
    const exempt = covered > half

    let decision: string
    if (graced) {
      decision = `sin multa — GRACIA DE ALTA (se incorporó en el mes)`
      reasons.grace++
    } else if (exempt) {
      decision = `sin multa — PROTEGIDO ${covered}/${daysInMonth} días (> mitad)`
      reasons.protected++
    } else if (played >= ladder.minMatchesPerMonth) {
      decision = `sin multa — llegó al mínimo (${played} ≥ ${ladder.minMatchesPerMonth})`
      reasons.metMin++
    } else {
      const points = Math.min(ladder.monthlyPenalty, m.rating - ladder.ratingFloor)
      if (points <= 0) {
        decision = `sin multa — piso alcanzado (rating ${m.rating} ≤ floor ${ladder.ratingFloor})`
        reasons.floor++
      } else {
        decision = `🔴 MULTA −${points}  →  ${m.rating - points}`
        wouldPenalize++
        reasons.penalize++
      }
    }
    console.log(`${name} ${String(m.rating).padStart(6)}  ${joined}   ${String(played).padStart(3)}  ${decision}`)
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`Se penalizarían: ${wouldPenalize} de ${members.length}`)
  console.log(`Motivos de exención: gracia=${reasons.grace}  protegido=${reasons.protected}  llegó-al-mínimo=${reasons.metMin}  piso=${reasons.floor}  → multa=${reasons.penalize}`)

  // Distribución de altas: ¿todos se sumaron en el mes que se cierra?
  const joinedInMonth = members.filter((m) => m.joinedAt >= startUTC && m.joinedAt <= endUTC).length
  console.log(`\nAltas (joinedAt) dentro de ${month}/${year}: ${joinedInMonth} de ${members.length}`)
  const minJoin = members.reduce((a, m) => (m.joinedAt < a ? m.joinedAt : a), members[0]?.joinedAt ?? new Date())
  const maxJoin = members.reduce((a, m) => (m.joinedAt > a ? m.joinedAt : a), members[0]?.joinedAt ?? new Date())
  console.log(`joinedAt más antiguo: ${minJoin.toISOString()}   más reciente: ${maxJoin.toISOString()}`)
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
