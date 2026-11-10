/**
 * QA: lleva la Copa Summum de prueba a un estado dado, usando los servicios reales
 * (createMatchResult propaga el cuadro como en la app). Solo para la base de prueba.
 * Antes: `pnpm tsx scripts/qa-dobles-seed.ts` (crea los 32 jugadores QA y el JSON).
 *
 *   pnpm tsx scripts/qa-dobles-estado.ts pre      # recarga limpia (cargar-dobles --reset --force --yes) y pone los partidos anteayer (misma hora)
 *   pnpm tsx scripts/qa-dobles-estado.ts grupoA   # solo los 6 partidos del grupo A (1 pendiente para la UI)
 *   pnpm tsx scripts/qa-dobles-estado.ts grupos   # los 24 de grupo → semis con parejas
 *   pnpm tsx scripts/qa-dobles-estado.ts semis    # + las 4 semis → finales con parejas
 *   pnpm tsx scripts/qa-dobles-estado.ts final    # + las 2 finales → campeones
 * Cada estado carga solo lo que falta (idempotente hacia adelante). Para volver atrás: `pre`.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { execFileSync } from 'child_process'

const JSON_PATH = process.env.QA_DOBLES_JSON ?? 'scripts/dobles/copa-summum.qa.json'
const SCORES: Array<[number, number, number | null, number | null]> = [[4, 1, null, null], [4, 2, null, null], [4, 3, 5, 3], [4, 0, null, null], [4, 3, 7, 5], [4, 2, null, null]]

async function main() {
  const estado = process.argv[2]
  if (!estado) throw new Error('uso: tsx scripts/qa-dobles-estado.ts <pre|grupoA|grupos|semis|final>')
  // Freno: este script mueve fechas y carga resultados inventados. Solo corre si el
  // torneo `copa-summum` de esta base es el de prueba (todos sus jugadores son QA).
  {
    const { prisma } = await import('../src/lib/prisma')
    const real = await prisma.player.count({
      where: { tournament: { slug: 'copa-summum' }, NOT: { email: { endsWith: '@life-tenis.test' } } },
    })
    if (real > 0) throw new Error(`El torneo copa-summum de esta base tiene ${real} jugadores reales: este script es solo para la base de prueba. No se tocó nada.`)
  }
  if (estado === 'pre') {
    execFileSync('pnpm', ['tsx', 'scripts/cargar-dobles.ts', JSON_PATH, '--reset', '--force', '--yes'], { stdio: 'inherit' })
  }
  const { prisma } = await import('../src/lib/prisma')
  const { createMatchResult } = await import('../src/services/match-result-service')
  const t = await prisma.tournament.findUnique({ where: { slug: 'copa-summum' }, select: { id: true } })
  if (!t) throw new Error('No está cargado copa-summum: corré `pre` primero')
  // QA: el torneo es el 14/11 y la app no deja cargar un resultado antes de la hora del
  // partido. Se corren todos los partidos a 2 días atrás (misma hora) para poder cargar.
  // Fecha fija: anteayer (UTC), conservando la hora original de cada partido. Idempotente.
  const target = new Date(); target.setUTCDate(target.getUTCDate() - 2)
  const all = await prisma.match.findMany({ where: { tournamentId: t.id, scheduledAt: { not: null } }, select: { id: true, scheduledAt: true } })
  let moved = 0
  for (const m of all) {
    const d = new Date(m.scheduledAt!)
    d.setUTCFullYear(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
    if (d.getTime() !== m.scheduledAt!.getTime()) { await prisma.match.update({ where: { id: m.id }, data: { scheduledAt: d } }); moved++ }
  }
  if (moved) console.log(`QA: ${moved} partidos puestos el ${target.toISOString().slice(0, 10)} (misma hora) para poder cargar resultados.`)
  if (estado === 'pre') { await prisma.$disconnect(); return }
  const stages = estado === 'grupoA' || estado === 'grupos' ? ['GROUP'] : estado === 'semis' ? ['GROUP', 'SEMIFINAL'] : ['GROUP', 'SEMIFINAL', 'FINAL']
  let loaded = 0
  for (const stage of stages) {
    // Las llaves reciben sus parejas al cargar la etapa anterior: releer en cada etapa.
    const matches = await prisma.match.findMany({
      where: { tournamentId: t.id, stage: stage as 'GROUP' | 'SEMIFINAL' | 'FINAL', result: null, ...(estado === 'grupoA' ? { group: { number: 1 } } : {}) },
      orderBy: [{ scheduledAt: 'asc' }, { courtNumber: 'asc' }],
      select: { id: true, player1Id: true, player2Id: true, group: { select: { number: true } } },
    })
    // grupoA deja exactamente 1 partido del grupo A sin resultado (idempotente).
    const toLoad = estado === 'grupoA' ? matches.slice(0, Math.max(0, matches.length - 1)) : matches
    for (const [i, m] of toLoad.entries()) {
      if (!m.player1Id || !m.player2Id) { console.log(`  salteado (sin lados): ${m.id}`); continue }
      const [a, b, tbA, tbB] = SCORES[i % SCORES.length]
      // Alternar quién gana para que haya variedad en las tablas.
      const p1wins = (i + (m.group?.number ?? 0)) % 3 !== 0
      await createMatchResult({
        matchId: m.id,
        reportedById: m.player1Id,
        set1Player1: p1wins ? a : b,
        set1Player2: p1wins ? b : a,
        tb1Player1: tbA == null ? null : p1wins ? tbA : tbB,
        tb1Player2: tbB == null ? null : p1wins ? tbB : tbA,
        winnerId: p1wins ? m.player1Id : m.player2Id,
      })
      loaded++
    }
  }
  const counts = await prisma.match.groupBy({ by: ['stage', 'status'], where: { tournamentId: t.id }, _count: true })
  console.log(`Estado "${estado}": ${loaded} resultados cargados.`, counts.map((c) => `${c.stage}/${c.status}=${c._count}`).join(' · '))
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
