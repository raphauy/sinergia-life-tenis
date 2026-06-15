import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

// Patrón del repo: DIRECT_DATABASE_URL (postgres directo). DATABASE_URL es Prisma
// Accelerate (prisma://) y no se puede consultar desde un script plano. Como
// `prisma migrate deploy` usa directUrl, esta es la misma branch Neon que ve la app.
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL,
})

const MS_DAY = 86_400_000

/**
 * Diagnóstico de la Sección Gallina: lista TODOS los retos RECHAZADOS y, para cada uno,
 * por qué califica o no (ventana 7 días, gap ±range, miembro activo, protegido).
 * Replica la lógica de getGallinas (ladder-stats-service.ts) sobre la BD directa.
 */
async function main() {
  const ladder = await prisma.ladder.findFirst({ where: { isActive: true } })
  if (!ladder) {
    console.log('No hay escalera activa.')
    return
  }
  const range = ladder.gallinaPositionRange
  const now = new Date()
  const since = new Date(now.getTime() - 7 * MS_DAY)
  console.log(`Escalera: ${ladder.name}  ·  gallinaPositionRange = ±${range}`)
  console.log(`Ahora: ${now.toISOString()}  ·  ventana desde: ${since.toISOString()}\n`)

  // Ranking actual (mismo orden que getLadderRanking: rating desc, joinedAt asc, id asc).
  const members = await prisma.ladderMember.findMany({
    where: { ladderId: ladder.id, isActive: true },
    orderBy: [{ rating: 'desc' }, { joinedAt: 'asc' }, { id: 'asc' }],
    select: { userId: true },
  })
  const posByUser = new Map(members.map((m, i) => [m.userId, i + 1]))

  // Protegidos ahora.
  const protections = await prisma.ladderProtection.findMany({
    where: {
      member: { ladderId: ladder.id },
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    select: { member: { select: { userId: true } } },
  })
  const protectedUsers = new Set(protections.map((p) => p.member.userId))

  // Todos los rechazos (sin filtro de fecha, para ver también los viejos).
  const rejections = await prisma.challenge.findMany({
    where: { ladderId: ladder.id, status: 'REJECTED' },
    orderBy: { respondedAt: 'desc' },
    select: {
      challengerId: true,
      challengedId: true,
      respondedAt: true,
      rankGapAtReject: true,
      challenger: { select: { firstName: true, lastName: true } },
      challenged: { select: { firstName: true, lastName: true } },
    },
  })

  console.log(`Rechazos totales (REJECTED): ${rejections.length}\n`)
  console.log('gallina (retado)            ← rechazó a (retador)        | respondedAt        díasAtrás | snap  live  gap  ±range | ventana mbro prot | CALIFICA / motivo')
  console.log('─'.repeat(170))

  const qualifyingByGallina = new Map<string, number>()

  for (const r of rejections) {
    const at = r.respondedAt
    const daysAgo = at ? (now.getTime() - at.getTime()) / MS_DAY : null
    const gName = `${r.challenged.firstName ?? ''} ${r.challenged.lastName ?? ''}`.trim() || '(?)'
    const cName = `${r.challenger.firstName ?? ''} ${r.challenger.lastName ?? ''}`.trim() || '(?)'
    const gPos = posByUser.get(r.challengedId) ?? null
    const cPos = posByUser.get(r.challengerId) ?? null
    const liveGap = cPos != null && gPos != null ? cPos - gPos : null
    const gap = r.rankGapAtReject ?? liveGap

    const inWindow = at != null && at.getTime() >= since.getTime()
    const isMember = posByUser.has(r.challengedId)
    const isProt = protectedUsers.has(r.challengedId)
    const within = gap != null && Math.abs(gap) <= range

    const reasons: string[] = []
    if (!inWindow) reasons.push(daysAgo == null ? 'sin fecha' : `fuera de ventana (${daysAgo.toFixed(1)}d)`)
    if (!isMember) reasons.push('retado no es miembro activo')
    if (isProt) reasons.push('retado protegido')
    if (gap == null) reasons.push('gap indeterminado (sin snapshot y algún no-miembro)')
    else if (!within) reasons.push(`gap ${gap} fuera de ±${range}`)

    const qualifies = inWindow && isMember && !isProt && within
    if (qualifies) qualifyingByGallina.set(r.challengedId, (qualifyingByGallina.get(r.challengedId) ?? 0) + 1)

    const gCol = `${gName}${gPos != null ? ` #${gPos}` : ''}`.padEnd(27)
    const cCol = `${cName}${cPos != null ? ` #${cPos}` : ''}`.padEnd(28)
    const dCol = `${at ? at.toISOString().slice(0, 16) : '—'.padEnd(16)}  ${daysAgo != null ? daysAgo.toFixed(1).padStart(5) : '  —  '}`
    const gapCol = `${String(r.rankGapAtReject ?? '·').padStart(4)} ${String(liveGap ?? '·').padStart(4)} ${String(gap ?? '·').padStart(4)} ${within ? '  sí' : '  no'}`
    const flags = `${inWindow ? ' sí ' : ' no '} ${isMember ? ' sí ' : ' no '} ${isProt ? ' sí ' : ' no '}`
    const verdict = qualifies ? '✅ CALIFICA' : `❌ ${reasons.join('; ')}`

    console.log(`${gCol} ← ${cCol} | ${dCol} | ${gapCol} | ${flags} | ${verdict}`)
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`Gallinas que CALIFICAN (distintas): ${qualifyingByGallina.size}`)
  for (const [uid, count] of qualifyingByGallina) {
    const m = await prisma.ladderMember.findFirst({
      where: { ladderId: ladder.id, userId: uid },
      select: { user: { select: { firstName: true, lastName: true } } },
    })
    const name = `${m?.user.firstName ?? ''} ${m?.user.lastName ?? ''}`.trim()
    console.log(`  - ${name}: ${count} rechazo(s) válido(s)  →  card muestra "(+${count - 1})"`)
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
