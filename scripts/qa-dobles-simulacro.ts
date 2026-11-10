/**
 * QA: simulacro del torneo entero contra la base de prueba (branch de Neon `dobles`),
 * con los servicios reales de la app y verificación automática después de cada tanda.
 *   pnpm tsx scripts/qa-dobles-simulacro.ts [semillas=6] [primeraSemilla=1]
 *
 * Cada semilla juega los 30 partidos con resultados al azar (incluye 4-3 con tiebreak y
 * W/O) y rota entre tres formas de cargar:
 *   - "turnos":    como el sábado: los dos partidos de cada turno se guardan a la vez.
 *   - "desorden":  resultados cargados tarde y mezclados entre grupos, de a 1–4 a la vez.
 *   - "avalancha": los 6 partidos de cada grupo a la vez (peor caso de concurrencia).
 * Algunas semillas fuerzan un triple empate para pasar por el desempate manual.
 * Al final corrige resultados (grupo y semi) y verifica que se acepte o rechace bien.
 *
 * Qué se verifica en cada paso (contra un cálculo independiente de la tabla):
 *   tabla del servicio = tabla independiente · cada semi tiene exactamente a quien
 *   corresponde (1° → oro, 2° → plata, y solo si su posición es definitiva) · una pareja
 *   puesta en una llave no cambia más · la final recibe a los ganadores de sus semis ·
 *   la vista del home coincide con la base · ningún resultado con ganador ajeno.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { execFileSync } from 'child_process'

const host = new URL(process.env.DATABASE_URL!).hostname
if (!host.startsWith('ep-frosty-dream-anas7zqh')) throw new Error(`Base inesperada (${host}): solo corre contra el branch dobles`)

let failures = 0
let checks = 0
let ctxLabel = ''
function check(ok: boolean, msg: string) {
  checks++
  if (!ok) {
    failures++
    console.log(`  ✗ [${ctxLabel}] ${msg}`)
  }
}

function rng(seed: number) {
  let s = seed * 2654435761 % 2147483647 || 1
  return (n: number) => { s = (s * 48271) % 2147483647; return s % n }
}

async function main() {
  const nSeeds = Number(process.argv[2] ?? 6)
  const firstSeed = Number(process.argv[3] ?? 1)
  const { prisma } = await import('../src/lib/prisma')
  const results = await import('../src/services/match-result-service')
  const ranking = await import('../src/services/ranking-service')
  const bracket = await import('../src/services/bracket-service')
  const view = await import('../src/services/doubles-view-service')
  const pairsSvc = await import('../src/services/doubles-pair-service')
  const matchSvc = await import('../src/services/match-service')
  const { setGroupTiebreakOrder } = await import('../src/services/group-service')

  // Punto de partida real: lo que deja el script de carga.
  execFileSync('pnpm', ['-s', 'tsx', 'scripts/qa-dobles-estado.ts', 'pre'], { stdio: 'ignore' })
  const t = await prisma.tournament.findUniqueOrThrow({ where: { slug: 'copa-summum' }, include: { categories: true } })
  const categoryId = t.categories[0].id
  const groups = await prisma.group.findMany({ where: { categoryId }, orderBy: { number: 'asc' } })
  const pairs = await pairsSvc.getPairsByCategory(categoryId)
  const name = (u: string | null) => (u ? pairs.find((p) => p.captain.userId === u)?.slug ?? `??${u.slice(-4)}` : '∅')

  const snapshot = async () =>
    (await prisma.match.findMany({
      where: { tournamentId: t.id },
      orderBy: [{ scheduledAt: 'asc' }, { courtNumber: 'asc' }],
      select: { id: true, stage: true, cup: true, bracketPosition: true, status: true, groupId: true, player1Id: true, player2Id: true, player1SourceGroupId: true, player1SourcePosition: true, player2SourceGroupId: true, player2SourcePosition: true, scheduledAt: true, courtNumber: true, playedAt: true },
    }))
  const initial = JSON.stringify(await snapshot())
  { const t1 = Date.now(); for (let i = 0; i < 5; i++) await prisma.$queryRaw`SELECT 1`; console.log(`latencia por consulta desde esta máquina: ~${Math.round((Date.now() - t1) / 5)} ms`) }
  console.log('torneo de prueba recargado; verificando permisos…')

  /** Vuelve al estado recién cargado sin recrear el torneo (se compara contra el real). */
  async function fastReset() {
    await prisma.matchResult.deleteMany({ where: { match: { tournamentId: t.id } } })
    await prisma.match.updateMany({ where: { tournamentId: t.id }, data: { status: 'CONFIRMED', playedAt: null } })
    await prisma.match.updateMany({ where: { tournamentId: t.id, stage: { not: 'GROUP' } }, data: { player1Id: null, player2Id: null } })
    await prisma.group.updateMany({ where: { categoryId }, data: { tiebreakOrder: [] } })
    if (JSON.stringify(await snapshot()) !== initial) throw new Error('fastReset no deja el estado del script de carga')
  }

  type M = Awaited<ReturnType<typeof loadMatches>>[number]
  const loadMatches = () =>
    prisma.match.findMany({
      where: { tournamentId: t.id },
      orderBy: [{ scheduledAt: 'asc' }, { courtNumber: 'asc' }],
      include: { result: true },
    })

  /** Tabla independiente de un grupo, leyendo los resultados crudos. */
  function oracle(ms: M[], groupId: string) {
    const own = ms.filter((m) => m.stage === 'GROUP' && m.groupId === groupId)
    const teams = [...new Set(own.flatMap((m) => [m.player1Id!, m.player2Id!]))]
    const st = new Map(teams.map((u) => [u, { u, w: 0, dg: 0, pj: 0 }]))
    const beat = new Set<string>()
    for (const m of own) {
      if (!m.result) continue
      const w = m.result.winnerId
      const l = w === m.player1Id ? m.player2Id! : m.player1Id!
      const diff = Math.abs(m.result.set1Player1 - m.result.set1Player2)
      st.get(w)!.w++; st.get(w)!.dg += diff; st.get(l)!.dg -= diff
      st.get(w)!.pj++; st.get(l)!.pj++
      beat.add(`${w}>${l}`)
    }
    const complete = own.every((m) => m.result)
    const rows = [...st.values()].sort((x, y) => y.w - x.w || y.dg - x.dg)
    const order: { u: string; tied: boolean; free?: string[] }[] = []
    for (let i = 0; i < rows.length; ) {
      let j = i + 1
      while (j < rows.length && rows[j].w === rows[i].w && rows[j].dg === rows[i].dg) j++
      const cl = rows.slice(i, j)
      if (cl.length === 1) order.push({ u: cl[0].u, tied: false })
      else if (cl.length === 2 && (beat.has(`${cl[0].u}>${cl[1].u}`) || beat.has(`${cl[1].u}>${cl[0].u}`))) {
        const f = beat.has(`${cl[0].u}>${cl[1].u}`) ? 0 : 1
        order.push({ u: cl[f].u, tied: false }, { u: cl[1 - f].u, tied: false })
      } else for (const c of cl) order.push({ u: c.u, tied: cl.length >= 3 && cl.some((x) => x.pj > 0), free: cl.map((x) => x.u) })
      i = j
    }
    // Posición asegurada por matemática pura: nadie más puede alcanzar esos ganados.
    const pending = new Map(teams.map((u) => [u, own.filter((m) => !m.result && (m.player1Id === u || m.player2Id === u)).length]))
    const max = (u: string) => st.get(u)!.w + pending.get(u)!
    const firstLocked = rows.slice(1).every((r) => max(r.u) < rows[0].w)
    const secondLocked = firstLocked && rows.slice(2).every((r) => max(r.u) < rows[1].w)
    return { order, complete, firstLocked, secondLocked, stats: st }
  }

  const sticky = new Map<string, string>() // "matchId:side" → pareja ya puesta
  /** Verifica todo el estado. `manual`: orden de desempate vigente por grupo. */
  async function verify(label: string, opts: { allowSlotChange?: boolean } = {}) {
    ctxLabel = label
    const ms = await loadMatches()
    const v = await view.getDoublesTournamentView(categoryId)
    const freshGroups = await prisma.group.findMany({ where: { categoryId }, orderBy: { number: 'asc' } })
    await Promise.all(freshGroups.map(async (g) => {
      const o = oracle(ms, g.id)
      const [table, q] = await Promise.all([ranking.getRankingByGroup(g.id), bracket.getGroupQualifiers(g.id)])
      check(table.length === 4, `grupo ${g.number}: la tabla tiene ${table.length} filas`)
      // Tabla del servicio vs independiente (con orden manual, las empatadas van en ese orden).
      const manual = g.tiebreakOrder
      const exp = o.order.map((e) => ({ ...e }))
      const tiedIdx = exp.map((e, i) => (e.tied ? i : -1)).filter((i) => i >= 0)
      if (tiedIdx.length && tiedIdx.every((i) => manual.includes(exp[i].u))) {
        const sorted = tiedIdx.map((i) => exp[i].u).sort((a, b) => manual.indexOf(a) - manual.indexOf(b))
        tiedIdx.forEach((i, k) => { exp[i] = { u: sorted[k], tied: false } })
      }
      const sameOrder = table.every((e, i) => (exp[i].tied ? e.tied === true : (e.userId === exp[i].u || (exp[i].free ?? []).includes(e.userId)) && !e.tied))
      const pending0 = [...o.stats.values()].every((s) => s.pj === 0)
      check(sameOrder || pending0, `grupo ${g.number}: tabla ${table.map((e) => name(e.userId) + (e.tied ? '=' : '')).join(' ')} ≠ independiente ${exp.map((e) => name(e.u) + (e.tied ? '=' : '')).join(' ')}`)
      for (const e of table) {
        const s = o.stats.get(e.userId)
        check(!!s && s.w === e.pg && s.dg === e.gamesDiff && s.pj === e.pj, `grupo ${g.number}: números de ${name(e.userId)} (PG ${e.pg}/${s?.w}, DG ${e.gamesDiff}/${s?.dg}, PJ ${e.pj}/${s?.pj})`)
      }
      // Quién debe estar en cada semi según el cálculo independiente.
      const expFirst = o.complete ? (exp[0].tied ? null : exp[0].u) : o.firstLocked ? exp[0].u : null
      const expSecond = o.complete ? (exp[1].tied ? null : exp[1].u) : o.secondLocked ? exp[1].u : null
      check((q.firstDecided ? q.first : null) === expFirst, `grupo ${g.number}: 1° decidido según app ${name(q.firstDecided ? q.first : null)} vs independiente ${name(expFirst)}`)
      check((q.secondDecided ? q.second : null) === expSecond, `grupo ${g.number}: 2° decidido según app ${name(q.secondDecided ? q.second : null)} vs independiente ${name(expSecond)}`)
      const sfPos = g.number <= 2 ? 1 : 2
      const side = g.number % 2 === 1 ? 'player1' : 'player2'
      for (const [cup, expected, position] of [['GOLD', expFirst, 1], ['SILVER', expSecond, 2]] as const) {
        const sf = ms.find((m) => m.stage === 'SEMIFINAL' && m.cup === cup && m.bracketPosition === sfPos)!
        const actual = sf[`${side}Id`]
        check(actual === expected, `semi ${sfPos} de ${cup}, lado del grupo ${g.number}: está ${name(actual)}, debería ${name(expected)}`)
        check(sf[`${side}SourceGroupId`] === g.id && sf[`${side}SourcePosition`] === position, `semi ${sfPos} de ${cup}: se perdió el origen del lado del grupo ${g.number}`)
        const key = `${sf.id}:${side}`
        if (!opts.allowSlotChange && sticky.has(key)) check(sticky.get(key) === actual, `semi ${sfPos} de ${cup}: la pareja ya puesta (${name(sticky.get(key)!)}) cambió a ${name(actual)}`)
        if (actual) sticky.set(key, actual); else sticky.delete(key)
      }
      // Vista del home.
      const gv = v.groups.find((x) => x.id === g.id)!
      check(gv.standings.map((s) => s.pair.pair.captain.userId).join() === table.map((e) => e.userId).join(), `grupo ${g.number}: la tabla del home no coincide con la del servicio`)
      check(gv.standings.every((s, i) => s.decided === ((i === 0 && q.firstDecided) || (i === 1 && q.secondDecided))), `grupo ${g.number}: resaltado de clasificados del home`)
      check(gv.hasUnresolvedTie === (o.complete && table.some((e) => e.tied)), `grupo ${g.number}: aviso de empate del home`)
    }))
    for (const cup of ['GOLD', 'SILVER'] as const) {
      const final = ms.find((m) => m.stage === 'FINAL' && m.cup === cup)!
      for (const pos of [1, 2]) {
        const sf = ms.find((m) => m.stage === 'SEMIFINAL' && m.cup === cup && m.bracketPosition === pos)!
        const expected = sf.result?.winnerId ?? null
        check((pos === 1 ? final.player1Id : final.player2Id) === expected, `final de ${cup}, lado ${pos}: está ${name(pos === 1 ? final.player1Id : final.player2Id)}, debería ${name(expected)}`)
      }
      const cv = v.cups.find((c) => c.cup === cup)!
      check((cv.champion?.pair.captain.userId ?? null) === (final.result?.winnerId ?? null), `campeón de ${cup} en el home`)
    }
    for (const m of ms) {
      check((m.status === 'PLAYED') === !!m.result, `partido ${m.id}: estado ${m.status} con resultado=${!!m.result}`)
      if (m.result) check(m.result.winnerId === m.player1Id || m.result.winnerId === m.player2Id, `partido ${m.stage} ${m.cup ?? ''}: el ganador no juega ese partido`)
      const mv = v.matches.find((x) => x.id === m.id)!
      check((mv.side1?.pair.captain.userId ?? null) === m.player1Id && (mv.side2?.pair.captain.userId ?? null) === m.player2Id, `partido ${m.id}: lados del home ≠ base`)
    }
    check(v.playedCount === ms.filter((m) => m.result).length && v.totalCount === 30, `contador del home ${v.playedCount}/${v.totalCount}`)
    return ms
  }

  function scoreFor(m: { player1Id: string | null; player2Id: string | null }, winner: string, loserGames: number, walkover = false) {
    const p1 = m.player1Id === winner
    if (walkover) return { walkover: true, set1Player1: p1 ? 4 : 0, set1Player2: p1 ? 0 : 4, tb1Player1: null, tb1Player2: null, winnerId: winner }
    const tb = loserGames === 3
    return { set1Player1: p1 ? 4 : loserGames, set1Player2: p1 ? loserGames : 4, tb1Player1: tb ? (p1 ? 5 : 3) : null, tb1Player2: tb ? (p1 ? 3 : 5) : null, winnerId: winner }
  }

  // ---------- Una vez: quién ve y quién puede cargar cada partido ----------
  ctxLabel = 'permisos'
  {
    const ms = await loadMatches()
    const groupMs = ms.filter((m) => m.stage === 'GROUP')
    const withModality = groupMs.map((m) => ({ ...m, tournament: { modality: 'DOUBLES' as const } }))
    const users = pairs.flatMap((p) => [p.captain.userId, p.partner.userId])
    check(users.length === 32 && new Set(users).size === 32, `${users.length} personas, ${new Set(users).size} distintas`)
    for (const p of pairs) {
      for (const u of [p.captain.userId, p.partner.userId]) {
        let mine = 0
        const ownGroup = withModality.filter((m) => m.groupId === withModality.find((x) => x.player1Id === p.captain.userId || x.player2Id === p.captain.userId)!.groupId)
        const foreign = withModality.filter((m) => !ownGroup.includes(m)).slice(0, 2)
        for (const m of [...ownGroup, ...foreign]) {
          const side = await pairsSvc.getUserSideInMatch(m, u)
          const expected = m.player1Id === p.captain.userId ? 1 : m.player2Id === p.captain.userId ? 2 : null
          check(side === expected, `lado de ${u} en ${m.id}: ${side} vs ${expected}`)
          if (side) mine++
        }
        check(mine === 3, `${name(p.captain.userId)} (${u === p.captain.userId ? 'capitán' : 'compañero'}) juega ${mine} partidos de grupo`)
        const upcoming = (await matchSvc.getUpcomingMatches(u)).filter((m) => m.tournamentId === t.id)
        check(upcoming.length === 3 && upcoming.every((m) => m.pairs?.side1 && m.pairs?.side2), `${u === p.captain.userId ? 'capitán' : 'compañero'} de ${name(p.captain.userId)} ve ${upcoming.length} próximos partidos de dobles`)
      }
    }
    // Semi sin parejas: nadie figura como jugador.
    const sf = ms.find((m) => m.stage === 'SEMIFINAL')!
    check((await pairsSvc.getUserSideInMatch({ ...sf, tournament: { modality: 'DOUBLES' } }, users[0])) === null, 'una semi sin parejas le figura a un jugador')
    // Guardas del servicio.
    const g0 = groupMs[0]
    const expectReject = async (label: string, fn: () => Promise<unknown>) => {
      try { await fn(); check(false, `${label}: se aceptó`) } catch { check(true, label) }
    }
    await expectReject('cargar una semi sin parejas', () => results.createMatchResult({ matchId: sf.id, reportedById: users[0], ...scoreFor(g0, g0.player1Id!, 1) }))
    await results.createMatchResult({ matchId: g0.id, reportedById: users[0], ...scoreFor(g0, g0.player1Id!, 1) })
    await expectReject('cargar dos veces el mismo partido', () => results.createMatchResult({ matchId: g0.id, reportedById: users[0], ...scoreFor(g0, g0.player2Id!, 2) }))
    await fastReset()
    console.log(`permisos y guardas: ${failures === 0 ? 'OK' : 'CON FALLAS'} (${checks} verificaciones)`)
  }

  const MODES = ['turnos', 'desorden', 'avalancha'] as const
  for (let seed = firstSeed; seed < firstSeed + nSeeds; seed++) {
    const rand = rng(seed)
    const mode = MODES[seed % 3]
    const forceTie = seed % 2 === 0 ? 1 + rand(4) : 0
    const t0 = Date.now()
    const before = failures
    await fastReset()
    sticky.clear()
    let ms = await verify(`s${seed} inicio`)
    const groupMs = ms.filter((m) => m.stage === 'GROUP')

    // Resultados del día, decididos de antemano.
    const plan = new Map<string, ReturnType<typeof scoreFor>>()
    for (const m of groupMs) {
      const winner = rand(2) ? m.player1Id! : m.player2Id!
      plan.set(m.id, rand(12) === 0 ? scoreFor(m, winner, 0, true) : scoreFor(m, winner, rand(4)))
    }
    if (forceTie) {
      // a>b, b>c, c>a por 4-2 y los tres le ganan a d 4-1: triple empate total por el 1°.
      const g = groups[forceTie - 1]
      const own = groupMs.filter((m) => m.groupId === g.id)
      const [a, b, c, d] = [...new Set(own.flatMap((m) => [m.player1Id!, m.player2Id!]))]
      const set = (x: string, y: string, lg: number) => { const m = own.find((m) => [m.player1Id, m.player2Id].includes(x) && [m.player1Id, m.player2Id].includes(y))!; plan.set(m.id, scoreFor(m, x, lg)) }
      set(a, b, 2); set(b, c, 2); set(c, a, 2); set(a, d, 1); set(b, d, 1); set(c, d, 1)
    }

    // Tandas según el modo.
    let batches: M[][] = []
    if (mode === 'turnos') {
      const bySlot = new Map<string, M[]>()
      for (const m of groupMs) { const k = m.scheduledAt!.toISOString(); bySlot.set(k, [...(bySlot.get(k) ?? []), m]) }
      batches = [...bySlot.values()]
    } else if (mode === 'avalancha') {
      batches = groups.flatMap((g) => { const own = groupMs.filter((m) => m.groupId === g.id); return [own.slice(0, 3), own.slice(3)] })
    } else {
      const shuffled = [...groupMs]
      for (let i = shuffled.length - 1; i > 0; i--) { const j = rand(i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]] }
      while (shuffled.length) batches.push(shuffled.splice(0, 1 + rand(4)))
    }
    let slowest = 0
    let timeouts = 0
    for (const [i, batch] of batches.entries()) {
      const tb = Date.now()
      const r = await Promise.allSettled(batch.map((m) => results.createMatchResult({ matchId: m.id, reportedById: m.player1Id!, ...plan.get(m.id)! })))
      slowest = Math.max(slowest, Date.now() - tb)
      ctxLabel = `s${seed} ${mode} tanda ${i + 1}`
      for (const [k, x] of r.entries()) {
        if (x.status === 'fulfilled') continue
        const msg = String((x.reason as Error).message).split('\n').pop() ?? ''
        if (/expired transaction|Transaction not found|Unable to start a transaction/.test(msg)) {
          timeouts++
          await results.createMatchResult({ matchId: batch[k].id, reportedById: batch[k].player1Id!, ...plan.get(batch[k].id)! })
        } else check(false, `guardar resultado falló: ${msg}`)
      }
      await verify(`s${seed} ${mode} tanda ${i + 1}/${batches.length}`)
    }

    // Triple empate: las semis esperan; el admin ordena.
    const tiedGroups: number[] = []
    for (const g of groups) {
      const tied = (await ranking.getRankingByGroup(g.id)).filter((e) => e.tied).map((e) => e.userId)
      if (!tied.length) continue
      tiedGroups.push(g.number)
      ctxLabel = `s${seed} desempate grupo ${g.number}`
      for (const bad of [tied.slice(0, 2), [...tied.slice(0, 2), tied[0]], [...tied, tied[0]]]) {
        try { await setGroupTiebreakOrder(g.id, bad); check(false, 'orden de desempate inválido aceptado') } catch { check(true, 'inválido rechazado') }
      }
      const order = [tied[1], tied[2], tied[0]]
      await setGroupTiebreakOrder(g.id, order)
      await verify(`s${seed} desempate grupo ${g.number}`)
      // Cambiarlo mientras la semi no se jugó.
      await setGroupTiebreakOrder(g.id, [...order].reverse())
      await verify(`s${seed} desempate cambiado grupo ${g.number}`, { allowSlotChange: true })
    }
    if (forceTie) check(tiedGroups.includes(forceTie), `no apareció el triple empate forzado en el grupo ${forceTie}`)

    // Semis: oro y plata del mismo turno a la vez. Después una corrección de semi con la final sin jugar.
    ms = await loadMatches()
    for (const pos of [1, 2]) {
      const sfs = ms.filter((m) => m.stage === 'SEMIFINAL' && m.bracketPosition === pos)
      ctxLabel = `s${seed} semis ${pos}`
      check(sfs.every((m) => m.player1Id && m.player2Id), `las semis ${pos} no tienen las dos parejas con los grupos terminados`)
      const r = await Promise.allSettled(sfs.map((m) => results.createMatchResult({ matchId: m.id, reportedById: m.player2Id!, ...scoreFor(m, rand(2) ? m.player1Id! : m.player2Id!, rand(4)) })))
      for (const x of r) check(x.status === 'fulfilled', `guardar semi falló: ${x.status === 'rejected' ? (x.reason as Error).message : ''}`)
      await verify(`s${seed} semis ${pos}`)
    }
    ms = await loadMatches()
    {
      const cupPick = rand(2) ? 'GOLD' : 'SILVER'
      const posPick = 1 + rand(2)
      const sf = ms.find((m) => m.stage === 'SEMIFINAL' && m.cup === cupPick && m.bracketPosition === posPick)!
      const other = sf.result!.winnerId === sf.player1Id ? sf.player2Id! : sf.player1Id!
      await results.updateMatchResult(sf.id, scoreFor(sf, other, rand(4)))
      await verify(`s${seed} semi corregida antes de la final`)
    }
    // Corrección de grupo con las semis jugadas: si cambia quién clasificó se rechaza entero; si no, se guarda.
    ms = await loadMatches()
    for (let k = 0; k < 4; k++) {
      const m = groupMs[rand(groupMs.length)]
      const cur = (await prisma.matchResult.findUniqueOrThrow({ where: { matchId: m.id } }))
      const flipped = scoreFor(m, cur.winnerId === m.player1Id ? m.player2Id! : m.player1Id!, rand(4))
      const beforeAll = JSON.stringify(await loadMatches())
      const g = groups.find((x) => x.id === m.groupId)!
      const qBefore = await bracket.getGroupQualifiers(g.id)
      let accepted = true
      try { await results.updateMatchResult(m.id, flipped) } catch { accepted = false }
      ctxLabel = `s${seed} corrección de grupo ${k + 1} (${accepted ? 'aceptada' : 'rechazada'})`
      if (!accepted) check(JSON.stringify(await loadMatches()) === beforeAll, 'una corrección rechazada dejó cambios en la base')
      else {
        const qAfter = await bracket.getGroupQualifiers(g.id)
        check(qAfter.first === qBefore.first && qAfter.second === qBefore.second, 'se aceptó una corrección que cambia los clasificados con la semi ya jugada')
      }
      await verify(ctxLabel)
    }
    // Finales a la vez; después, corregir una semi tiene que rechazarse.
    ms = await loadMatches()
    const finals = ms.filter((m) => m.stage === 'FINAL')
    ctxLabel = `s${seed} finales`
    check(finals.every((m) => m.player1Id && m.player2Id), 'las finales no tienen las dos parejas')
    const rf = await Promise.allSettled(finals.map((m) => results.createMatchResult({ matchId: m.id, reportedById: m.player1Id!, ...scoreFor(m, rand(2) ? m.player1Id! : m.player2Id!, rand(4)) })))
    for (const x of rf) check(x.status === 'fulfilled', `guardar final falló: ${x.status === 'rejected' ? (x.reason as Error).message : ''}`)
    ms = await verify(`s${seed} finales`)
    {
      const sf = ms.find((m) => m.stage === 'SEMIFINAL')!
      const beforeAll = JSON.stringify(ms)
      let rejected = false
      try { await results.updateMatchResult(sf.id, scoreFor(sf, sf.result!.winnerId === sf.player1Id ? sf.player2Id! : sf.player1Id!, 1)) } catch { rejected = true }
      ctxLabel = `s${seed} semi corregida con la final jugada`
      check(rejected, 'se aceptó cambiar el ganador de una semi con la final jugada')
      check(JSON.stringify(await loadMatches()) === beforeAll, 'la corrección rechazada dejó cambios')
      // Corregir solo el marcador (mismo ganador) sí se puede.
      await results.updateMatchResult(sf.id, scoreFor(sf, sf.result!.winnerId, (Math.min(sf.result!.set1Player1, sf.result!.set1Player2) + 1) % 3))
      await verify(`s${seed} semi con marcador corregido`)
    }
    // Todos ven sus partidos en el historial.
    ms = await loadMatches()
    ctxLabel = `s${seed} historial`
    for (const p of [pairs[rand(16)], pairs[rand(16)]]) {
      const expected = ms.filter((m) => m.player1Id === p.captain.userId || m.player2Id === p.captain.userId).length
      for (const u of [p.captain.userId, p.partner.userId]) {
        const got = (await matchSvc.getMatchesByPlayer(u)).filter((m) => m.tournamentId === t.id).length
        check(got === expected, `${name(p.captain.userId)}: ${u === p.captain.userId ? 'capitán' : 'compañero'} ve ${got} partidos, jugó ${expected}`)
      }
    }
    console.log(`semilla ${seed} · ${mode}${forceTie ? ` · triple empate forzado en grupo ${forceTie}` : ''}${tiedGroups.length ? ` · empates en ${tiedGroups.join(',')}` : ''} · tanda más lenta ${(slowest / 1000).toFixed(1)} s${timeouts ? ` · ${timeouts} guardados vencidos por tiempo y reintentados` : ''} · ${((Date.now() - t0) / 1000).toFixed(0)} s · ${failures === before ? 'OK' : `${failures - before} FALLAS`}`)
  }

  await fastReset()
  console.log(`\n${failures === 0 ? '✓ TODO OK' : `✗ ${failures} FALLAS`} · ${checks} verificaciones`)
  await prisma.$disconnect()
  process.exit(failures ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
