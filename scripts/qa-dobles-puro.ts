/**
 * QA sin base de datos: pruebas exhaustivas de la lógica pura de la Copa Summum.
 *   pnpm tsx scripts/qa-dobles-puro.ts
 *
 * 1. Tabla de un grupo de 4 contra un oráculo independiente, para TODOS los resultados
 *    posibles (64 combinaciones de ganadores × 4096 de games del perdedor).
 * 2. "Posición decidida" con el grupo a medias: para cada estado parcial, si la app da
 *    por decidido al 1° o al 2° (y lo manda a una semi), ningún desenlace posible de los
 *    partidos que faltan puede cambiarlo.
 * 3. Validación del set a 4: todos los marcadores 0..7 × tiebreaks.
 * 4. Ventana de carga (resultLoadOpen) en los bordes del día en Uruguay.
 */
process.env.DATABASE_URL ??= 'postgresql://x:x@localhost:5432/x' // nunca se conecta

let failures = 0
let checks = 0
function check(ok: boolean, msg: string) {
  checks++
  if (!ok) {
    failures++
    if (failures <= 25) console.log('  ✗', msg)
  }
}

const TEAMS = ['a', 'b', 'c', 'd']
const FIXTURE: [string, string][] = [['a', 'b'], ['c', 'd'], ['a', 'c'], ['b', 'd'], ['a', 'd'], ['b', 'c']]

type Outcome = { winner: 0 | 1; loserGames: number } | null

function mkMatch(i: number, o: Outcome, tbTwist = false) {
  const [p1, p2] = FIXTURE[i]
  const base = {
    id: `m${i}`, player1Id: p1, player2Id: p2, stage: 'GROUP', status: o ? 'PLAYED' : 'CONFIRMED',
  }
  if (!o) return { ...base, result: null }
  const p1wins = o.winner === 0
  return {
    ...base,
    result: {
      winnerId: p1wins ? p1 : p2,
      set1Player1: p1wins ? 4 : o.loserGames,
      set1Player2: p1wins ? o.loserGames : 4,
      set2Player1: null, set2Player2: null, set3Player1: null, set3Player2: null,
      // El tiebreak no debe contar como games.
      tb1Player1: o.loserGames === 3 ? (p1wins ? (tbTwist ? 9 : 5) : 3) : null,
      tb1Player2: o.loserGames === 3 ? (p1wins ? 3 : tbTwist ? 9 : 5) : null,
    },
  }
}

/** Oráculo independiente: ganados, diferencia de games, y entre DOS empatadas el partido entre ellas. */
function oracle(outcomes: Outcome[]) {
  const st = new Map(TEAMS.map((t) => [t, { t, w: 0, dg: 0 }]))
  const beat = new Set<string>()
  outcomes.forEach((o, i) => {
    if (!o) return
    const [p1, p2] = FIXTURE[i]
    const [w, l] = o.winner === 0 ? [p1, p2] : [p2, p1]
    st.get(w)!.w++
    st.get(w)!.dg += 4 - o.loserGames
    st.get(l)!.dg -= 4 - o.loserGames
    beat.add(`${w}>${l}`)
  })
  const rows = [...st.values()].sort((x, y) => y.w - x.w || y.dg - x.dg)
  const order: { t: string; tied: boolean }[] = []
  for (let i = 0; i < rows.length; ) {
    let j = i + 1
    while (j < rows.length && rows[j].w === rows[i].w && rows[j].dg === rows[i].dg) j++
    const cluster = rows.slice(i, j)
    if (cluster.length === 1) order.push({ t: cluster[0].t, tied: false })
    else if (cluster.length === 2) {
      const [x, y] = cluster
      const first = beat.has(`${x.t}>${y.t}`) ? x : y
      order.push({ t: first.t, tied: false }, { t: first === x ? y.t : x.t, tied: false })
    } else for (const c of cluster) order.push({ t: c.t, tied: true })
    i = j
  }
  return order
}

async function main() {
  const { rankDoublesPlayers } = await import('../src/services/ranking-service')
  const { computeGroupQualifiers } = await import('../src/services/bracket-service')
  const { createMatchResultSchema } = await import('../src/lib/validations/match-result')
  const { resultLoadOpen } = await import('../src/lib/date-utils')

  const member = (id: string) => ({ playerId: `P${id}`, playerSlug: id, userId: id, firstName: id.toUpperCase(), lastName: `Ap${id}`, displayName: null, email: `${id}@x`, image: null })
  const pairs = TEAMS.map((t) => ({ id: `pair-${t}`, categoryId: 'cat', slug: `pair-${t}`, captain: member(t), partner: member(`${t}2`) }))
  // Como en la base: en el grupo están los capitanes Y los compañeros.
  const players = TEAMS.flatMap((t) => [{ id: `P${t}`, slug: t, userId: t }, { id: `P${t}2`, slug: `${t}2`, userId: `${t}2` }])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rank = (ms: any[], order: string[] = []) => rankDoublesPlayers(players, pairs as any, ms.filter((m) => m.result), order)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quals = (ms: any[], order: string[] = []) => {
    const played = ms.filter((m) => m.result)
    return computeGroupQualifiers(rank(ms, order), ms.length, played.length, ms.filter((m) => !m.result))
  }

  // ---------- 1. Tabla final contra el oráculo ----------
  console.log('\n1. Tabla del grupo terminado contra oráculo (64 × 4096 resultados)')
  let tiesSeen = 0
  let firstTied = 0
  let secondOnlyTied = 0
  for (let w = 0; w < 64; w++) {
    for (let g = 0; g < 4096; g++) {
      const outcomes: Outcome[] = FIXTURE.map((_, i) => ({ winner: ((w >> i) & 1) as 0 | 1, loserGames: (g >> (2 * i)) & 3 }))
      const ms = outcomes.map((o, i) => mkMatch(i, o, (w + g) % 2 === 0))
      const got = rank(ms)
      const exp = oracle(outcomes)
      const same = got.length === 4 && got.every((e, i) => e.userId === exp[i].t || (exp[i].tied && e.tied))
      const tiedSame = got.every((e) => (e.tied === true) === exp.find((x) => x.t === e.userId)!.tied)
      check(same && tiedSame, `tabla w=${w} g=${g}: app ${got.map((e) => e.userId + (e.tied ? '=' : '')).join(',')} vs oráculo ${exp.map((e) => e.t + (e.tied ? '=' : '')).join(',')}`)
      const q = quals(ms)
      const anyTied = exp.some((e) => e.tied)
      if (anyTied) tiesSeen++
      check(q.fullyDecided, 'grupo completo no marcado fullyDecided')
      check(q.firstDecided === !exp[0].tied && q.secondDecided === !exp[1].tied, `decididos con grupo completo w=${w} g=${g}: first=${q.firstDecided} second=${q.secondDecided}`)
      check((q.first ?? null) === (exp[0].tied ? null : exp[0].t) && (q.second ?? null) === (exp[1].tied ? null : exp[1].t), `clasificados w=${w} g=${g}`)
      if (exp[0].tied) firstTied++
      else if (exp[1].tied) secondOnlyTied++
      // Desempate manual: cualquier orden de las empatadas se respeta y destraba el grupo.
      if (anyTied && g % 97 === 0) {
        const tied = exp.filter((e) => e.tied).map((e) => e.t)
        const order = [tied[2], tied[0], tied[1]]
        const r2 = rank(ms, order)
        const q2 = quals(ms, order)
        const pos = r2.filter((e) => tied.includes(e.userId)).map((e) => e.userId)
        check(pos.join() === order.join() && r2.every((e) => !e.tied), `orden manual no respetado: ${pos} vs ${order}`)
        check(q2.firstDecided && q2.secondDecided && q2.first === r2[0].userId && q2.second === r2[1].userId, 'orden manual no destraba clasificados')
        // Un orden viejo que no nombra a todas las empatadas no se aplica.
        const stale = rank(ms, [tied[0], tied[1], 'zzz'])
        check(stale.filter((e) => e.tied).length === 3, 'orden manual incompleto se aplicó igual')
      }
    }
  }
  console.log(`   ${checks} verificaciones · resultados con triple empate: ${tiesSeen} de ${64 * 4096} (${((100 * tiesSeen) / (64 * 4096)).toFixed(1)} %): ${firstTied} por el 1° y ${secondOnlyTied} solo por el 2°`)

  // ---------- 2. "Decidido" con el grupo a medias ----------
  console.log('\n2. Posiciones decididas con el grupo a medias (729 estados × desenlaces × games)')
  const before = checks
  let earlyFirst = 0
  let earlySecond = 0
  let rnd = 12345
  const rand = (n: number) => { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd % n }
  for (let s = 0; s < 729; s++) {
    // dígito base 3 por partido: 0 sin jugar, 1 gana p1, 2 gana p2
    const digits = FIXTURE.map((_, i) => Math.floor(s / 3 ** i) % 3)
    const pendingIdx = digits.map((d, i) => (d === 0 ? i : -1)).filter((i) => i >= 0)
    if (pendingIdx.length === 0) continue
    for (let rep = 0; rep < 6; rep++) {
      const partial: Outcome[] = digits.map((d) => (d === 0 ? null : { winner: (d - 1) as 0 | 1, loserGames: rand(4) }))
      const q = quals(partial.map((o, i) => mkMatch(i, o)))
      check(!q.fullyDecided, 'grupo incompleto marcado fullyDecided')
      check(!q.secondDecided || q.firstDecided, 'segundo decidido sin primero decidido')
      if (!q.firstDecided && !q.secondDecided) continue
      if (q.firstDecided) earlyFirst++
      if (q.secondDecided) earlySecond++
      for (let c = 0; c < 1 << pendingIdx.length; c++) {
        for (let r2 = 0; r2 < 4; r2++) {
          const full = partial.map((o, i) => {
            const k = pendingIdx.indexOf(i)
            return o ?? { winner: ((c >> k) & 1) as 0 | 1, loserGames: rand(4) }
          })
          const fin = oracle(full)
          if (q.firstDecided) check(fin[0].t === q.first && !fin[0].tied, `1° dado por decidido (${q.first}) y termina ${fin[0].t}${fin[0].tied ? '=' : ''} · estado ${digits.join('')}`)
          if (q.secondDecided) check(fin[1].t === q.second && !fin[1].tied, `2° dado por decidido (${q.second}) y termina ${fin[1].t}${fin[1].tied ? '=' : ''} · estado ${digits.join('')}`)
        }
      }
    }
  }
  console.log(`   ${checks - before} verificaciones · estados con 1° adelantado: ${earlyFirst}, con 2° adelantado: ${earlySecond}`)

  // ---------- 3. Validación del set a 4 ----------
  console.log('\n3. Validación del set a 4 (todos los marcadores 0..8 y tiebreaks 0..12)')
  const before3 = checks
  const schema = createMatchResultSchema('SHORT_SET_4', 'U1', 'U2')
  for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8; b++) {
    const needsTb = (a === 4 && b === 3) || (a === 3 && b === 4)
    const validSet = (a === 4 && b <= 3) || (b === 4 && a <= 3)
    for (const asString of [false, true]) {
      const v = (n: number) => (asString ? String(n) : n)
      const noTb = schema.safeParse({ set1Player1: v(a), set1Player2: v(b), tb1Player1: '', tb1Player2: '' })
      check(noTb.success === (validSet && !needsTb), `set ${a}-${b} sin tiebreak: aceptado=${noTb.success}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (noTb.success) check((noTb.data as any).winnerId === (a > b ? 'U1' : 'U2') && (noTb.data as any).tb1Player1 === null, `ganador de ${a}-${b}`)
    }
    for (let x = 0; x <= 12; x++) for (let y = 0; y <= 12; y++) {
      const r = schema.safeParse({ set1Player1: a, set1Player2: b, tb1Player1: String(x), tb1Player2: String(y) })
      const hi = Math.max(x, y), lo = Math.min(x, y)
      const tbOk = (hi === 5 && lo <= 3) || (hi > 5 && hi - lo === 2)
      const tbSide = (a > b) === (x > y)
      const expected = validSet && (!needsTb || (tbOk && tbSide))
      check(r.success === expected, `set ${a}-${b} tb ${x}-${y}: aceptado=${r.success}, esperado=${expected}`)
      if (r.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = r.data as any
        check(d.winnerId === (a > b ? 'U1' : 'U2'), `ganador ${a}-${b}`)
        check(needsTb ? d.tb1Player1 === x && d.tb1Player2 === y : d.tb1Player1 === null && d.tb1Player2 === null, `tiebreak guardado en ${a}-${b} (${d.tb1Player1}-${d.tb1Player2})`)
      }
    }
  }
  for (const bad of [{ set1Player1: '', set1Player2: '4' }, { set1Player1: '4', set1Player2: '' }, { set1Player1: '4' }, { set1Player1: 'x', set1Player2: '4' }, { set1Player1: '4.5', set1Player2: '2' }, { set1Player1: '-1', set1Player2: '4' }, { set1Player1: ' ', set1Player2: '4' }, {}]) {
    check(!schema.safeParse(bad).success, `entrada inválida aceptada: ${JSON.stringify(bad)}`)
  }
  // W/O: 4-0 para el ganador, solo los dos capitanes como ganador válido.
  const wo = createMatchResultSchema('SHORT_SET_4', 'U1', 'U2', true)
  const w1 = wo.safeParse({ winnerId: 'U1' }), w2 = wo.safeParse({ winnerId: 'U2' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  check(w1.success && (w1.data as any).set1Player1 === 4 && (w1.data as any).set1Player2 === 0 && (w1.data as any).walkover === true, 'W/O lado 1')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  check(w2.success && (w2.data as any).set1Player1 === 0 && (w2.data as any).set1Player2 === 4, 'W/O lado 2')
  check(!wo.safeParse({ winnerId: 'OTRO' }).success && !wo.safeParse({}).success, 'W/O con ganador ajeno aceptado')
  // Los formatos viejos no cambiaron: 6-4 vale, 4-2 no; 7-6 exige tiebreak.
  const single = createMatchResultSchema('SINGLE_SET', 'U1', 'U2')
  check(single.safeParse({ set1Player1: 6, set1Player2: 4 }).success, 'SINGLE_SET 6-4')
  check(!single.safeParse({ set1Player1: 4, set1Player2: 2 }).success, 'SINGLE_SET acepta 4-2')
  check(!single.safeParse({ set1Player1: 7, set1Player2: 6, tb1Player1: '', tb1Player2: '' }).success, 'SINGLE_SET 7-6 sin tiebreak')
  check(single.safeParse({ set1Player1: 7, set1Player2: 6, tb1Player1: '7', tb1Player2: '3' }).success, 'SINGLE_SET 7-6 (7-3)')
  console.log(`   ${checks - before3} verificaciones`)

  // ---------- 4. Ventana de carga ----------
  console.log('\n4. Ventana de carga del resultado (día del torneo en Uruguay, UTC-3)')
  const before4 = checks
  const uy = (s: string) => new Date(`${s}-03:00`)
  const semi = uy('2026-11-14T11:30:00')
  const cases: [string, Date | null, boolean, string, boolean][] = [
    ['dobles, viernes 23:59 UY', semi, true, '2026-11-13T23:59:00', false],
    ['dobles, sábado 00:00 UY', semi, true, '2026-11-14T00:00:00', true],
    ['dobles, sábado 07:00 UY (antes de su hora)', semi, true, '2026-11-14T07:00:00', true],
    ['dobles, sábado 23:59 UY', semi, true, '2026-11-14T23:59:00', true],
    ['dobles, domingo (ya pasó)', semi, true, '2026-11-15T10:00:00', true],
    ['dobles, viernes 21:30 UY (ya es sábado en UTC)', semi, true, '2026-11-13T21:30:00', false],
    ['singles, mismo día antes de hora', semi, false, '2026-11-14T07:00:00', false],
    ['singles, después de hora', semi, false, '2026-11-14T11:31:00', true],
    ['sin hora', null, true, '2026-11-01T00:00:00', true],
  ]
  for (const [label, at, dbl, now, exp] of cases) check(resultLoadOpen(at, dbl, uy(now)) === exp, `${label}: esperado ${exp}`)
  console.log(`   ${checks - before4} verificaciones`)

  console.log(`\n${failures === 0 ? '✓ TODO OK' : `✗ ${failures} FALLAS`} · ${checks} verificaciones en total`)
  process.exit(failures ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
