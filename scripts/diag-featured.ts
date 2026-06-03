import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { weekRangeUY } from '../src/lib/date-utils'
import { formatInTimeZone } from 'date-fns-tz'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL,
})

const TZ = 'America/Montevideo'
const fmt = (d: Date | null) =>
  d ? formatInTimeZone(d, TZ, 'EEE dd/MM/yyyy HH:mm') : '(sin fecha)'

async function main() {
  const { startUTC, endUTC } = weekRangeUY()
  console.log('Hoy (UY):', formatInTimeZone(new Date(), TZ, 'EEE dd/MM/yyyy HH:mm'))
  console.log('Ventana semana destacados (UY):')
  console.log('  desde:', fmt(startUTC))
  console.log('  hasta:', fmt(endUTC))
  console.log()

  const ladder = await prisma.ladder.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!ladder) {
    console.log('No hay escalera (ladder).')
    return
  }
  console.log('Escalera:', ladder.id, '\n')

  // Inventario completo de la escalera por estado, para ver si los PENDING tienen reserva.
  const all = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: { in: ['PENDING', 'CONFIRMED', 'PLAYED'] } },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      player1: { select: { firstName: true, lastName: true } },
      player2: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }],
  })

  const name = (p: { firstName: string | null; lastName: string | null } | null) =>
    p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : '—'

  for (const st of ['PENDING', 'CONFIRMED', 'PLAYED'] as const) {
    const list = all.filter((m) => m.status === st)
    const conFecha = list.filter((m) => m.scheduledAt != null).length
    console.log(`\n[${st}]  total ${list.length}  ·  con fecha ${conFecha}  ·  sin fecha ${list.length - conFecha}`)
    for (const m of list) console.log(`   ${fmt(m.scheduledAt)}  ${name(m.player1)} vs ${name(m.player2)}`)
  }

  // Simulación del filtro FINAL: por venir = todo reto aceptado (PENDING+CONFIRMED, con
  // o sin reserva); jugados = PLAYED de la semana corriente. La fecha de un PENDING viene
  // de su SlotReservation (no de match.scheduledAt). Orden real es por importancia (acá no
  // hay ratings, así que solo mostramos qué entra).
  const pendingIds = all.filter((m) => m.status === 'PENDING').map((m) => m.id)
  const reservas = await prisma.slotReservation.findMany({
    where: { matchId: { in: pendingIds } },
    select: { matchId: true, scheduledAt: true },
  })
  const resMap = new Map(reservas.map((r) => [r.matchId, r.scheduledAt]))

  const playedSince = new Date(startUTC.getTime()) // placeholder reasignado abajo
  playedSince.setTime(Date.now() - 2 * 24 * 60 * 60 * 1000) // hace 2 días
  const entran = all.filter((m) => {
    if (m.status === 'PLAYED') return m.scheduledAt != null && m.scheduledAt >= playedSince
    return true // PENDING o CONFIRMED: siempre, tengan o no reserva
  })
  console.log(`\n=> Entran con el filtro final: ${entran.length} (se mostrarían los 7 más importantes)`)
  for (const m of entran) {
    const fecha = m.status === 'PENDING' ? resMap.get(m.id) ?? null : m.scheduledAt
    const etiqueta = m.status === 'PENDING' && fecha ? `reserva ${fmt(fecha)}` : fmt(fecha)
    console.log(`   ✅ [${m.status}]  ${etiqueta}  ${name(m.player1)} vs ${name(m.player2)}`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
