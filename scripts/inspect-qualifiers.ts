import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL,
})

// Inline simplified computation using the same logic
async function main() {
  const groups = await prisma.group.findMany({
    include: {
      category: { select: { name: true } },
      players: { where: { isActive: true, userId: { not: null } }, select: { userId: true } },
    },
    orderBy: [{ number: 'asc' }],
  })
  groups.sort((a, b) => a.category.name.localeCompare(b.category.name) || a.number - b.number)

  for (const g of groups) {
    const matches = await prisma.match.findMany({
      where: { groupId: g.id, stage: 'GROUP', status: { not: 'CANCELLED' } },
      include: { result: true },
    })
    const playerIds = g.players.map((p) => p.userId!)

    // Compute points (wins) per player
    const stats: Record<string, { pj: number; pg: number; maxMore: number }> = {}
    for (const uid of playerIds) stats[uid] = { pj: 0, pg: 0, maxMore: 0 }
    for (const m of matches) {
      if (m.result) {
        if (m.player1Id && stats[m.player1Id]) stats[m.player1Id].pj++
        if (m.player2Id && stats[m.player2Id]) stats[m.player2Id].pj++
        if (m.result.winnerId && stats[m.result.winnerId]) stats[m.result.winnerId].pg++
      } else if (m.status !== 'CANCELLED') {
        if (m.player1Id && stats[m.player1Id]) stats[m.player1Id].maxMore++
        if (m.player2Id && stats[m.player2Id]) stats[m.player2Id].maxMore++
      }
    }

    const users = await prisma.user.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, firstName: true, lastName: true },
    })
    const nameById = new Map(users.map((u) => [u.id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()]))

    const rows = playerIds.map((uid) => ({
      uid,
      name: nameById.get(uid) || 'unknown',
      pg: stats[uid].pg,
      max: stats[uid].pg + stats[uid].maxMore,
    }))
    rows.sort((a, b) => b.pg - a.pg || a.name.localeCompare(b.name))

    // firstDecided?
    const leader = rows[0]
    let firstDecided = true
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].max >= leader.pg) { firstDecided = false; break }
    }

    // qualifiersDecided?
    const second = rows[1]
    let qualifiersDecided = true
    for (let i = 2; i < rows.length; i++) {
      if (rows[i].max >= second.pg) { qualifiersDecided = false; break }
    }

    const secondDecided = firstDecided && qualifiersDecided

    console.log(`Cat ${g.category.name} - Grupo ${g.number} (firstDec=${firstDecided}, secondDec=${secondDecided}, qualifDec=${qualifiersDecided}):`)
    for (const r of rows) {
      console.log(`  ${r.name.padEnd(30)} pg=${r.pg} max=${r.max}`)
    }
    const firstName = firstDecided || qualifiersDecided ? leader.name : '—'
    const secondName = secondDecided || qualifiersDecided ? second.name : '—'
    console.log(`  → slot 1°: ${firstName} | slot 2°: ${secondName}`)
    console.log()
  }
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
