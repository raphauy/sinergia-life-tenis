/**
 * QA de servicios: escenarios de riesgo de la Copa Summum contra la
 * base de prueba (branch de Neon `dobles`). Usa los servicios reales de la app.
 *   pnpm tsx scripts/qa-dobles-servicios.ts <escenario>
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { execFileSync } from 'child_process'

const host = new URL(process.env.DATABASE_URL!).hostname
if (!host.startsWith('ep-frosty-dream-anas7zqh')) throw new Error(`Base inesperada (${host}): solo corre contra el branch dobles`)

type Ctx = Awaited<ReturnType<typeof load>>

async function load() {
  const { prisma } = await import('../src/lib/prisma')
  const results = await import('../src/services/match-result-service')
  const pairsSvc = await import('../src/services/doubles-pair-service')
  const view = await import('../src/services/doubles-view-service')
  const ranking = await import('../src/services/ranking-service')
  const { pairShortName } = await import('../src/lib/pair-display')
  const t = await prisma.tournament.findUniqueOrThrow({ where: { slug: 'copa-summum' }, include: { categories: true } })
  const categoryId = t.categories[0].id
  const pairs = await pairsSvc.getPairsByCategory(categoryId)
  const name = (userId: string | null) => {
    if (!userId) return '∅'
    const p = pairs.find((x) => x.captain.userId === userId)
    return p ? pairShortName(p) : `??${userId.slice(-4)}`
  }
  return { prisma, results, pairsSvc, view, ranking, t, categoryId, pairs, name }
}

async function resetDb(c: Ctx, estado = 'pre') {
  execFileSync('pnpm', ['-s', 'tsx', 'scripts/qa-dobles-estado.ts', estado], { stdio: 'ignore' })
  // --reset recrea el torneo: releer ids y parejas.
  const t = await c.prisma.tournament.findUniqueOrThrow({ where: { slug: 'copa-summum' }, include: { categories: true } })
  c.categoryId = t.categories[0].id
  c.pairs.splice(0, c.pairs.length, ...(await c.pairsSvc.getPairsByCategory(c.categoryId)))
}

async function group(c: Ctx, number: number) {
  const g = await c.prisma.group.findFirstOrThrow({ where: { categoryId: c.categoryId, number } })
  const matches = await c.prisma.match.findMany({
    where: { groupId: g.id, stage: 'GROUP' },
    orderBy: [{ scheduledAt: 'asc' }, { courtNumber: 'asc' }],
    include: { result: true },
  })
  const captains = [...new Set(matches.flatMap((m) => [m.player1Id!, m.player2Id!]))]
  return { g, matches, captains }
}

/** Carga (o edita) el partido entre x e y: gana `winner` por 4-`loserGames`. */
async function play(c: Ctx, matches: Awaited<ReturnType<typeof group>>['matches'], x: string, y: string, winner: string, loserGames: number, edit = false) {
  const m = matches.find((m) => [m.player1Id, m.player2Id].includes(x) && [m.player1Id, m.player2Id].includes(y))!
  const p1wins = m.player1Id === winner
  const tb = loserGames === 3
  const data = {
    set1Player1: p1wins ? 4 : loserGames,
    set1Player2: p1wins ? loserGames : 4,
    tb1Player1: tb ? (p1wins ? 5 : 2) : null,
    tb1Player2: tb ? (p1wins ? 2 : 5) : null,
    winnerId: winner,
  }
  if (edit) return c.results.updateMatchResult(m.id, data)
  return c.results.createMatchResult({ matchId: m.id, reportedById: winner, ...data })
}

async function dumpBracket(c: Ctx, title: string) {
  const ms = await c.prisma.match.findMany({
    where: { categoryId: c.categoryId, stage: { not: 'GROUP' } },
    orderBy: [{ cup: 'asc' }, { stage: 'asc' }, { bracketPosition: 'asc' }],
    include: { result: true, player1SourceGroup: true, player2SourceGroup: true },
  })
  console.log(`  [${title}]`)
  for (const m of ms) {
    const src = (g: { number: number } | null, p: number | null) => (g ? `(src ${p}°G${g.number})` : '')
    const res = m.result ? ` → gana ${c.name(m.result.winnerId)}${[m.player1Id, m.player2Id].includes(m.result.winnerId) ? '' : '  ⚠ GANADOR NO ESTÁ EN EL PARTIDO'}` : ''
    console.log(
      `    ${m.cup} ${m.stage}${m.bracketPosition ?? ''} ${m.status}: ${c.name(m.player1Id)} ${src(m.player1SourceGroup, m.player1SourcePosition)} vs ${c.name(m.player2Id)} ${src(m.player2SourceGroup, m.player2SourcePosition)}${res}`
    )
  }
}

async function dumpTable(c: Ctx, number: number) {
  const { g } = await group(c, number)
  const svc = await c.ranking.getRankingByGroup(g.id)
  const v = await c.view.getDoublesTournamentView(c.categoryId)
  const gv = v.groups.find((x) => x.id === g.id)!
  console.log(`  Tabla grupo ${number} (servicio que alimenta el cuadro): ` + svc.map((e) => `${e.position}° ${c.name(e.userId)} PG${e.pg} DG${e.gamesDiff}`).join(' | '))
  console.log(`  Tabla grupo ${number} (vista del home):                  ` + gv.standings.map((s) => `${s.position}° ${s.pair.shortName} PG${s.pg} DG${s.dg}${s.decided ? '✓' : ''}`).join(' | '))
}

const scenarios: Record<string, (c: Ctx) => Promise<void>> = {
  /** Los dos últimos partidos de un grupo se cargan a la vez (dos canchas, mismo turno). */
  async carrera(c) {
    for (let round = 1; round <= 5; round++) {
      await resetDb(c)
      const { matches, captains: [a, b, cc, d] } = await group(c, 4)
      await play(c, matches, a, b, a, 1)
      await play(c, matches, cc, d, cc, 1)
      await play(c, matches, a, cc, a, 2)
      await play(c, matches, b, d, b, 2)
      // Última fecha: a-d y b-cc terminan juntos y dos jugadores guardan a la vez.
      const r = await Promise.allSettled([play(c, matches, a, d, a, 0), play(c, matches, b, cc, b, 0)])
      const bracket = await c.prisma.match.findMany({ where: { categoryId: c.categoryId, stage: 'SEMIFINAL', bracketPosition: 2 }, orderBy: { cup: 'asc' } })
      const ok = bracket.every((m) => m.player2Id != null && m.player2SourceGroupId == null)
      console.log(`  ronda ${round}: ${r.map((x) => x.status).join(',')} → semis 2: oro lado2=${c.name(bracket[0].player2Id)} plata lado2=${c.name(bracket[1].player2Id)} fuente limpia=${bracket.map((m) => m.player2SourceGroupId == null)} ${ok ? 'OK' : '⚠ GRUPO TERMINADO Y LA SEMI NO QUEDÓ DEFINIDA'}`)
    }
  },

  /** Carrera donde la última fecha define el orden: a 2-0, b y c 1-1; se juegan a-d y b-c a la vez. */
  async carrera2(c) {
    for (let round = 1; round <= 4; round++) {
      await resetDb(c)
      const { g, matches, captains: [a, b, cc, d] } = await group(c, 4)
      await play(c, matches, a, b, a, 3)
      await play(c, matches, cc, d, cc, 0)
      await play(c, matches, a, cc, a, 3)
      await play(c, matches, b, d, b, 0)
      // b le gana a c 4-0 y queda con mejor DG que a; pero a gana y es 1° con 3 PG.
      await Promise.allSettled([play(c, matches, a, d, a, 3), play(c, matches, b, cc, b, 0)])
      const table = await c.ranking.getRankingByGroup(g.id)
      const sf = await c.prisma.match.findMany({ where: { categoryId: c.categoryId, stage: 'SEMIFINAL', bracketPosition: 2 }, orderBy: { cup: 'asc' } })
      const ok = sf[0].player2Id === table[0].userId && sf[1].player2Id === table[1].userId
      console.log(`  ronda ${round}: tabla final 1° ${c.name(table[0].userId)} 2° ${c.name(table[1].userId)} · semi oro: ${c.name(sf[0].player2Id)} · semi plata: ${c.name(sf[1].player2Id)} · fuentes limpias=${sf.map((m) => m.player2SourceGroupId == null)} ${ok ? 'OK' : '⚠ LLAVES NO COINCIDEN CON LA TABLA'}`)
    }
  },

  /** Corregir un grupo cuando la semi a la que alimenta ya se jugó: se rechaza y no cambia nada. */
  async guardia(c) {
    await resetDb(c)
    for (const n of [1, 2]) {
      const { matches, captains: [a, b, cc, d] } = await group(c, n)
      await play(c, matches, a, b, a, 1); await play(c, matches, cc, d, cc, 1); await play(c, matches, a, cc, a, 2)
      await play(c, matches, b, d, b, 2); await play(c, matches, a, d, a, 0); await play(c, matches, b, cc, b, 0)
    }
    const semi = await c.prisma.match.findFirstOrThrow({ where: { categoryId: c.categoryId, stage: 'SEMIFINAL', cup: 'GOLD', bracketPosition: 1 } })
    await c.results.createMatchResult({ matchId: semi.id, reportedById: semi.player1Id!, set1Player1: 4, set1Player2: 1, winnerId: semi.player1Id! })
    const { matches, captains: [a, b] } = await group(c, 1)
    try { await play(c, matches, a, b, b, 1, true); console.log('  ⚠ la corrección que cambia el 1° se guardó con la semi jugada') }
    catch (err) { console.log('  corrección que cambia el 1° con la semi de oro jugada: rechazada →', (err as Error).message) }
    await play(c, matches, a, b, a, 2, true)
    console.log('  corrección que NO cambia posiciones (4-1 → 4-2): guardada')
    await dumpTable(c, 1)
    await dumpBracket(c, 'después')
  },

  /** Dos de los cuatro cargan el mismo partido a la vez. */
  async doble(c) {
    await resetDb(c)
    const { matches, captains: [a, b] } = await group(c, 1)
    const r = await Promise.allSettled([play(c, matches, a, b, a, 1), play(c, matches, a, b, b, 2)])
    console.log('  ', r.map((x) => (x.status === 'fulfilled' ? 'ok' : `falla: ${(x.reason as Error).message?.split('\n').pop()} code=${(x.reason as { code?: string }).code}`)))
    const m = await c.prisma.match.findFirst({ where: { id: matches.find((m) => [m.player1Id, m.player2Id].includes(a) && [m.player1Id, m.player2Id].includes(b))!.id }, include: { result: true } })
    console.log(`  queda: ${m!.status} ${m!.result!.set1Player1}-${m!.result!.set1Player2} gana ${c.name(m!.result!.winnerId)}`)
  },

  /** Se corrige un resultado de grupo después de cerrado el grupo y cambia el 1°/2°. */
  async correccion(c) {
    await resetDb(c)
    const { matches, captains: [a, b, cc, d] } = await group(c, 1)
    await play(c, matches, a, b, a, 1)
    await play(c, matches, cc, d, cc, 1)
    await play(c, matches, a, cc, a, 2)
    await play(c, matches, b, d, b, 2)
    await play(c, matches, a, d, a, 0)
    await play(c, matches, b, cc, b, 0)
    await dumpTable(c, 1)
    await dumpBracket(c, 'grupo A cerrado: a 1°, b 2°')
    console.log('  → el admin corrige a-b: en realidad ganó b 4-1')
    await play(c, matches, a, b, b, 1, true)
    await dumpTable(c, 1)
    await dumpBracket(c, 'después de corregir')
  },

  /** Triple empate en PG y DG (a>b, b>c, c>a, todos le ganan a d por lo mismo). */
  async triple(c) {
    await resetDb(c)
    const { matches, captains: [a, b, cc, d] } = await group(c, 2)
    await play(c, matches, a, b, a, 2)
    await play(c, matches, b, cc, b, 2)
    await play(c, matches, cc, a, cc, 2)
    await play(c, matches, a, d, a, 1)
    await play(c, matches, b, d, b, 1)
    await play(c, matches, cc, d, cc, 1)
    await dumpTable(c, 2)
    await dumpBracket(c, 'triple empate total en grupo B: las semis esperan')
    const { setGroupTiebreakOrder } = await import('../src/services/group-service')
    const { g } = await group(c, 2)
    for (const [label, ids] of [['faltan parejas', [a, b]], ['pareja que no empata', [a, b, d]], ['repetida', [a, a, b]]] as const) {
      try { await setGroupTiebreakOrder(g.id, [...ids]); console.log(`  ⚠ orden inválido (${label}) aceptado`) }
      catch (err) { console.log(`  orden inválido (${label}): rechazado → ${(err as Error).message}`) }
    }
    console.log('  → el admin define el orden: c, a, b')
    await setGroupTiebreakOrder(g.id, [cc, a, b])
    await dumpTable(c, 2)
    await dumpBracket(c, 'orden definido')
    console.log('  → el admin lo cambia: b, c, a')
    await setGroupTiebreakOrder(g.id, [b, cc, a])
    await dumpBracket(c, 'orden cambiado')
    // Grupo C: una pareja 3-0 y las otras tres empatadas en 1 ganado → 1° decidido, 2° espera.
    const gc = await group(c, 3)
    const [e, f, h, i] = gc.captains
    await play(c, gc.matches, e, f, e, 1); await play(c, gc.matches, e, h, e, 1); await play(c, gc.matches, e, i, e, 1)
    await play(c, gc.matches, f, h, f, 2); await play(c, gc.matches, h, i, h, 2); await play(c, gc.matches, i, f, i, 2)
    await dumpTable(c, 3)
    await dumpBracket(c, 'grupo C: 1° claro, triple empate por el 2°')
  },

  /** Top-2 asegurado con el orden abierto: llaves tentativas, y una semi cargada antes del último partido. */
  async tentativo(c) {
    await resetDb(c)
    const { matches, captains: [a, b, cc, d] } = await group(c, 1)
    // a y b ganan sus dos primeros; falta a-b (define 1°/2°) y cc-d.
    await play(c, matches, a, cc, a, 1)
    await play(c, matches, b, d, b, 1)
    await play(c, matches, a, d, a, 1)
    await play(c, matches, b, cc, b, 0)
    await dumpTable(c, 1)
    await dumpBracket(c, 'grupo A 4/6: a y b clasificados, orden abierto')
    const v = await c.view.getDoublesTournamentView(c.categoryId)
    console.log(`  definitionStarted=${v.definitionStarted}`)
    // Grupo B completo para que la semi 1 tenga los dos lados.
    const gb = await group(c, 2)
    const [e, f, g, h] = gb.captains
    await play(c, gb.matches, e, f, e, 1); await play(c, gb.matches, g, h, g, 1); await play(c, gb.matches, e, g, e, 1)
    await play(c, gb.matches, f, h, f, 1); await play(c, gb.matches, e, h, e, 1); await play(c, gb.matches, f, g, f, 1)
    const semi = await c.prisma.match.findFirstOrThrow({ where: { categoryId: c.categoryId, stage: 'SEMIFINAL', cup: 'GOLD', bracketPosition: 1 } })
    try {
      await c.results.createMatchResult({ matchId: semi.id, reportedById: semi.player1Id!, set1Player1: 4, set1Player2: 1, winnerId: semi.player1Id! })
      console.log('  semi de oro 1 cargada con un lado TENTATIVO: el servicio lo permitió')
    } catch (err) { console.log('  semi de oro 1 con lado tentativo: rechazada →', (err as Error).message) }
    console.log('  → se carga a-b: gana b (b pasa a 1°)')
    await play(c, matches, a, b, b, 2)
    await play(c, matches, cc, d, cc, 2)
    await dumpTable(c, 1)
    await dumpBracket(c, 'grupo A cerrado con b 1°')
  },

  /** Flujo completo + edición de una semi antes y después de jugada la final + W/O. */
  async llaves(c) {
    await resetDb(c)
    await resetDb(c, 'grupos')
    await dumpBracket(c, 'grupos completos')
    const sf = await c.prisma.match.findMany({ where: { categoryId: c.categoryId, stage: 'SEMIFINAL' }, orderBy: [{ cup: 'asc' }, { bracketPosition: 'asc' }] })
    // Las dos semis de oro a la vez.
    const gold = sf.filter((m) => m.cup === 'GOLD')
    const silver = sf.filter((m) => m.cup === 'SILVER')
    const r = await Promise.allSettled(gold.map((m) => c.results.createMatchResult({ matchId: m.id, reportedById: m.player1Id!, set1Player1: 4, set1Player2: 2, winnerId: m.player1Id! })))
    console.log('  semis de oro simultáneas:', r.map((x) => x.status))
    // Plata: una por W/O (4-0) ganando el lado 2.
    await c.results.createMatchResult({ matchId: silver[0].id, reportedById: silver[0].player2Id!, walkover: true, set1Player1: 0, set1Player2: 4, winnerId: silver[0].player2Id! })
    await dumpBracket(c, 'semis de oro + semi 1 de plata por W/O')
    console.log('  → admin corrige semi de oro 1: ganó el lado 2')
    await c.results.updateMatchResult(gold[0].id, { set1Player1: 2, set1Player2: 4, winnerId: gold[0].player2Id! })
    await dumpBracket(c, 'semi de oro 1 corregida (final sin jugar)')
    const final = await c.prisma.match.findFirstOrThrow({ where: { categoryId: c.categoryId, stage: 'FINAL', cup: 'GOLD' } })
    await c.results.createMatchResult({ matchId: final.id, reportedById: final.player1Id!, set1Player1: 4, set1Player2: 3, tb1Player1: 5, tb1Player2: 3, winnerId: final.player1Id! })
    try {
      await c.results.updateMatchResult(gold[0].id, { set1Player1: 4, set1Player2: 2, winnerId: gold[0].player1Id! })
      console.log('  ⚠ corregir la semi con la final ya jugada: lo permitió')
    } catch (err) { console.log('  corregir la semi con la final jugada: rechazado →', (err as Error).message) }
    await dumpBracket(c, 'final de oro jugada')
    const v = await c.view.getDoublesTournamentView(c.categoryId)
    console.log('  campeones:', v.cups.map((x) => `${x.title}: ${x.champion?.shortName ?? '—'}`).join(' | '), `· jugados ${v.playedCount}/${v.totalCount}`)
  },

  /** Permisos: quién cuenta como jugador de un partido. */
  async permisos(c) {
    await resetDb(c)
    const { matches } = await group(c, 1)
    const m = await c.prisma.match.findUniqueOrThrow({ where: { id: matches[0].id }, include: { tournament: { select: { modality: true } } } })
    const p1 = c.pairs.find((p) => p.captain.userId === m.player1Id)!
    const p2 = c.pairs.find((p) => p.captain.userId === m.player2Id)!
    const other = c.pairs.find((p) => p.id !== p1.id && p.id !== p2.id)!
    const side = (u: string) => c.pairsSvc.getUserSideInMatch(m, u)
    console.log('  capitán L1, compañero L1, capitán L2, compañero L2, capitán ajeno, compañero ajeno →',
      await side(p1.captain.userId), await side(p1.partner.userId), await side(p2.captain.userId), await side(p2.partner.userId), await side(other.captain.userId), await side(other.partner.userId))
    const { getUpcomingMatches, getMatchesByPlayer } = await import('../src/services/match-service')
    console.log(`  próximos del compañero L1: ${(await getUpcomingMatches(p1.partner.userId)).length} · del capitán L1: ${(await getUpcomingMatches(p1.captain.userId)).filter((x) => x.pairs).length} (dobles) · todos del compañero: ${(await getMatchesByPlayer(p1.partner.userId)).length}`)
  },
}

async function main() {
  const which = process.argv.slice(2)
  const c = await load()
  for (const key of which.length ? which : Object.keys(scenarios)) {
    console.log(`\n=== ${key} ===`)
    try { await scenarios[key](c) } catch (err) { console.log('  ✗ ERROR DEL ESCENARIO:', err) }
  }
  await c.prisma.$disconnect()
}
main()
