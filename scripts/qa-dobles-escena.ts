/**
 * QA de UI: deja la Copa Summum de prueba en una escena puntual (sobre el estado `pre`).
 *   pnpm tsx scripts/qa-dobles-escena.ts <escena>
 *
 *   triple       grupo A terminado normal + grupo B terminado con triple empate por el 1°
 *                (sin resolver: las semis 1 esperan al admin).
 *   semi-jugada  los 4 grupos terminados sin empates + semi 1 de oro jugada
 *                (para probar que corregir un grupo se rechaza).
 *   hoy-tarde    todos los partidos hoy a las 23:30 (UY): todavía no es su hora.
 *   manana       todos los partidos mañana (UY): no se puede cargar todavía.
 *   anteayer     todos los partidos anteayer (como deja `qa-dobles-estado pre`).
 * Las escenas de resultados parten de cero (borran los resultados cargados).
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const host = new URL(process.env.DATABASE_URL!).hostname
if (!host.startsWith('ep-frosty-dream-anas7zqh')) throw new Error(`Base inesperada (${host}): solo corre contra el branch dobles`)

async function main() {
  const escena = process.argv[2]
  const { prisma } = await import('../src/lib/prisma')
  const { createMatchResult } = await import('../src/services/match-result-service')
  const { parseFromUY, formatDateUY } = await import('../src/lib/date-utils')
  const t = await prisma.tournament.findUniqueOrThrow({ where: { slug: 'copa-summum' }, include: { categories: true } })
  const categoryId = t.categories[0].id

  async function clean() {
    await prisma.matchResult.deleteMany({ where: { match: { tournamentId: t.id } } })
    await prisma.match.updateMany({ where: { tournamentId: t.id }, data: { status: 'CONFIRMED', playedAt: null } })
    await prisma.match.updateMany({ where: { tournamentId: t.id, stage: { not: 'GROUP' } }, data: { player1Id: null, player2Id: null } })
    await prisma.group.updateMany({ where: { categoryId }, data: { tiebreakOrder: [] } })
  }
  async function group(number: number) {
    const g = await prisma.group.findFirstOrThrow({ where: { categoryId, number } })
    const matches = await prisma.match.findMany({ where: { groupId: g.id, stage: 'GROUP' }, orderBy: [{ scheduledAt: 'asc' }, { courtNumber: 'asc' }] })
    const caps = [...new Set(matches.flatMap((m) => [m.player1Id!, m.player2Id!]))]
    const play = async (x: string, y: string, loserGames: number) => {
      const m = matches.find((m) => [m.player1Id, m.player2Id].includes(x) && [m.player1Id, m.player2Id].includes(y))!
      const p1 = m.player1Id === x
      await createMatchResult({ matchId: m.id, reportedById: x, set1Player1: p1 ? 4 : loserGames, set1Player2: p1 ? loserGames : 4, winnerId: x })
    }
    return { caps, play }
  }
  /** a 3-0, b 2-1, c 1-2, d 0-3. */
  async function normal(number: number) {
    const { caps: [a, b, c, d], play } = await group(number)
    await play(a, b, 1); await play(c, d, 1); await play(a, c, 2); await play(b, d, 2); await play(a, d, 0); await play(b, c, 0)
  }
  async function moveAll(dateUY: string, timeUY?: string) {
    const all = await prisma.match.findMany({ where: { tournamentId: t.id, scheduledAt: { not: null } }, select: { id: true, scheduledAt: true } })
    for (const m of all) {
      await prisma.match.update({ where: { id: m.id }, data: { scheduledAt: parseFromUY(dateUY, timeUY ?? formatDateUY(m.scheduledAt!, 'HH:mm')) } })
    }
    console.log(`${all.length} partidos puestos el ${dateUY}${timeUY ? ` a las ${timeUY}` : ' (misma hora)'} (UY)`)
  }
  const dayUY = (offset: number) => formatDateUY(new Date(Date.now() + offset * 86_400_000), 'yyyy-MM-dd')

  if (escena === 'triple') {
    await clean()
    await normal(1)
    const { caps: [a, b, c, d], play } = await group(2)
    await play(a, b, 2); await play(b, c, 2); await play(c, a, 2); await play(a, d, 1); await play(b, d, 1); await play(c, d, 1)
    console.log('Grupo A terminado; grupo B con triple empate por el 1° sin resolver.')
  } else if (escena === 'semi-jugada') {
    await clean()
    for (const n of [1, 2, 3, 4]) await normal(n)
    const semi = await prisma.match.findFirstOrThrow({ where: { categoryId, stage: 'SEMIFINAL', cup: 'GOLD', bracketPosition: 1 } })
    await createMatchResult({ matchId: semi.id, reportedById: semi.player1Id!, set1Player1: 4, set1Player2: 2, winnerId: semi.player1Id! })
    console.log('Grupos terminados y semi 1 de oro jugada.')
  } else if (escena === 'hoy-tarde') await moveAll(dayUY(0), '23:30')
  else if (escena === 'manana') await moveAll(dayUY(1))
  else if (escena === 'anteayer') await moveAll(dayUY(-2))
  else throw new Error('uso: tsx scripts/qa-dobles-escena.ts <triple|semi-jugada|hoy-tarde|manana|anteayer>')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
