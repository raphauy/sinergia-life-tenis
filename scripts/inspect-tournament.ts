import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL,
})

async function main() {
  const tournaments = await prisma.tournament.findMany({
    where: { isActive: true },
    include: {
      categories: {
        include: {
          groups: {
            include: {
              players: {
                select: { id: true, firstName: true, lastName: true, userId: true },
              },
              matches: {
                select: { id: true, status: true },
              },
            },
            orderBy: { number: 'asc' },
          },
          _count: { select: { players: true, matches: true } },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  for (const t of tournaments) {
    console.log(`\n=== Torneo: ${t.name} (slug: ${t.slug}) ===`)
    console.log(`  startDate: ${t.startDate.toISOString()}  endDate: ${t.endDate.toISOString()}`)
    console.log(`  matchFormat: ${t.matchFormat}`)
    for (const cat of t.categories) {
      console.log(`\n  [Categoría ${cat.name}]  players=${cat._count.players}  matches=${cat._count.matches}  groups=${cat.groups.length}`)
      for (const g of cat.groups) {
        const statusCounts = g.matches.reduce<Record<string, number>>((acc, m) => {
          acc[m.status] = (acc[m.status] ?? 0) + 1
          return acc
        }, {})
        console.log(`    Grupo ${g.number}: ${g.players.length} jugadores, partidos=${g.matches.length} (${JSON.stringify(statusCounts)})`)
        for (const p of g.players) {
          console.log(`      - ${p.firstName} ${p.lastName}${p.userId ? '' : ' (sin cuenta)'}`)
        }
      }
      // Partidos sin grupo en esta categoría
      const noGroupCount = await prisma.match.count({
        where: { categoryId: cat.id, groupId: null },
      })
      console.log(`    Partidos sin grupo en la categoría: ${noGroupCount}`)
    }
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
