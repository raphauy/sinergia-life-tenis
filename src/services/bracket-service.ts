import { prisma } from '@/lib/prisma'
import { getRankingByGroup, type RankingEntry } from './ranking-service'
import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

const bracketMatchIncludes = {
  player1: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, image: true } },
  player2: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, image: true } },
  tournament: { select: { id: true, name: true, matchFormat: true, finalsDate: true } },
  category: { select: { id: true, name: true } },
  group: { select: { id: true, number: true } },
  player1SourceGroup: { select: { id: true, number: true } },
  player2SourceGroup: { select: { id: true, number: true } },
  result: { include: { reportedBy: { select: { firstName: true, lastName: true } } } },
  reservation: true,
} as const

export type BracketMatch = Prisma.MatchGetPayload<{ include: typeof bracketMatchIncludes }>

export interface BracketSummary {
  quarterfinals: BracketMatch[]
  semifinals: BracketMatch[]
  final: BracketMatch | null
}

type GroupQualifiers = {
  first: string | null
  second: string | null
  /** true if the player at position 1º is mathematically locked there */
  firstDecided: boolean
  /** true if the player at position 2º is mathematically locked there */
  secondDecided: boolean
  /** true if all group matches are PLAYED (order 1º/2º is final) */
  fullyDecided: boolean
  /** true if both qualifiers are known (may be partial - order subject to change) */
  qualifiersDecided: boolean
}

type GroupData = {
  groupId: string
  groupNumber: number
  ranking: RankingEntry[]
  qualifiers: GroupQualifiers
}

type Slot = {
  entry: RankingEntry
  groupId: string
  groupNumber: number
  qualifiers: GroupQualifiers
  position: 1 | 2
}

// Compare helper (without head-to-head, which only applies intra-group)
function compareGlobal(a: RankingEntry, b: RankingEntry): number {
  if (b.points !== a.points) return b.points - a.points
  if (b.pg !== a.pg) return b.pg - a.pg
  if (b.gamesDiff !== a.gamesDiff) return b.gamesDiff - a.gamesDiff
  return a.player.name.localeCompare(b.player.name)
}

export async function getBracketByCategory(categoryId: string): Promise<BracketSummary> {
  const matches = await prisma.match.findMany({
    where: { categoryId, stage: { not: 'GROUP' } },
    include: bracketMatchIncludes,
    orderBy: [{ stage: 'asc' }, { bracketPosition: 'asc' }],
  })

  const quarterfinals = matches.filter((m) => m.stage === 'QUARTERFINAL')
  const semifinals = matches.filter((m) => m.stage === 'SEMIFINAL')
  const final = matches.find((m) => m.stage === 'FINAL') ?? null

  return { quarterfinals, semifinals, final }
}

/**
 * Computes who are the 2 qualifiers of a group, evaluating each position (1º, 2º)
 * independently. A position is considered "decided" when the current tentative
 * player cannot mathematically fall below that position, regardless of pending
 * match outcomes.
 *
 * Example: in a 4-player group where the leader has 3 points and the rest have
 * at most 2 possible, the leader is `firstDecided=true` even if position 2 is
 * still contested among others (`secondDecided=false`).
 */
export async function getGroupQualifiers(groupId: string, tx?: Tx): Promise<GroupQualifiers> {
  const client = tx ?? prisma
  const ranking = await getRankingByGroup(groupId, tx)
  const empty: GroupQualifiers = {
    first: null,
    second: null,
    firstDecided: false,
    secondDecided: false,
    fullyDecided: false,
    qualifiersDecided: false,
  }
  if (ranking.length < 2) return empty

  const totalCount = await client.match.count({
    where: { groupId, stage: 'GROUP', status: { not: 'CANCELLED' } },
  })
  const playedCount = await client.match.count({
    where: { groupId, stage: 'GROUP', status: 'PLAYED' },
  })
  const fullyDecided = totalCount > 0 && playedCount === totalCount

  if (fullyDecided) {
    return {
      first: ranking[0].userId,
      second: ranking[1].userId,
      firstDecided: true,
      secondDecided: true,
      fullyDecided: true,
      qualifiersDecided: true,
    }
  }

  // Compute max possible points per user
  const pendingMatches = await client.match.findMany({
    where: { groupId, stage: 'GROUP', status: { in: ['PENDING', 'CONFIRMED'] } },
    select: { player1Id: true, player2Id: true },
  })
  const pendingByUser: Record<string, number> = {}
  for (const m of pendingMatches) {
    if (m.player1Id) pendingByUser[m.player1Id] = (pendingByUser[m.player1Id] ?? 0) + 1
    if (m.player2Id) pendingByUser[m.player2Id] = (pendingByUser[m.player2Id] ?? 0) + 1
  }
  const maxByUser = new Map<string, number>()
  for (const entry of ranking) {
    maxByUser.set(entry.userId, entry.points + (pendingByUser[entry.userId] ?? 0))
  }

  const leader = ranking[0]
  const secondPlacer = ranking[1]

  // firstDecided: current leader's points strictly beat every other player's
  // max possible points. Leader cannot be displaced.
  let firstDecided = true
  for (let i = 1; i < ranking.length; i++) {
    if ((maxByUser.get(ranking[i].userId) ?? 0) >= leader.points) {
      firstDecided = false
      break
    }
  }

  // qualifiersDecided: the top-2 set (as a set, regardless of internal order)
  // is locked. Every player from 3rd place down has max < 2nd place's points.
  let qualifiersDecided = true
  for (let i = 2; i < ranking.length; i++) {
    if ((maxByUser.get(ranking[i].userId) ?? 0) >= secondPlacer.points) {
      qualifiersDecided = false
      break
    }
  }

  // secondDecided: the current 2nd-placer is locked in position 2. Requires
  // both firstDecided (so the leader can't drop) AND qualifiersDecided (so
  // no one from below can climb).
  const secondDecided = firstDecided && qualifiersDecided

  // `first`/`second` include tentative assignments when the set is locked but
  // the internal order may still flip. The `*Decided` flags indicate whether
  // the assignment is final (can clear the source) or tentative (keep source
  // so refreshBracketSlotsFromGroup can re-assign later).
  const first = firstDecided || qualifiersDecided ? leader.userId : null
  const second = secondDecided || qualifiersDecided ? secondPlacer.userId : null

  return {
    first,
    second,
    firstDecided,
    secondDecided,
    fullyDecided: false,
    qualifiersDecided,
  }
}

async function loadGroupData(categoryId: string): Promise<GroupData[]> {
  const groups = await prisma.group.findMany({
    where: { categoryId },
    orderBy: { number: 'asc' },
  })

  const result: GroupData[] = []
  for (const g of groups) {
    const [ranking, qualifiers] = await Promise.all([
      getRankingByGroup(g.id),
      getGroupQualifiers(g.id),
    ])
    result.push({
      groupId: g.id,
      groupNumber: g.number,
      ranking,
      qualifiers,
    })
  }
  return result
}

function orderedFirsts(groups: GroupData[]): Slot[] {
  return groups
    .filter((g) => g.ranking[0])
    .map<Slot>((g) => ({
      entry: g.ranking[0],
      groupId: g.groupId,
      groupNumber: g.groupNumber,
      qualifiers: g.qualifiers,
      position: 1,
    }))
    .sort((a, b) => compareGlobal(a.entry, b.entry))
}

function orderedSeconds(groups: GroupData[]): Slot[] {
  return groups
    .filter((g) => g.ranking[1])
    .map<Slot>((g) => ({
      entry: g.ranking[1],
      groupId: g.groupId,
      groupNumber: g.groupNumber,
      qualifiers: g.qualifiers,
      position: 2,
    }))
    .sort((a, b) => compareGlobal(a.entry, b.entry))
}

function slotAsMatchSide(slot: Slot, prefix: 'player1' | 'player2'): Record<string, string | number | null> {
  const q = slot.qualifiers
  const isPosition1 = slot.position === 1
  const userId = isPosition1 ? q.first : q.second
  const positionDecided = isPosition1 ? q.firstDecided : q.secondDecided

  if (positionDecided && userId) {
    // This specific position is locked — assign and clear source
    return {
      [`${prefix}Id`]: userId,
      [`${prefix}SourceGroupId`]: null,
      [`${prefix}SourcePosition`]: null,
    }
  }
  if (userId) {
    // Player is a tentative assignment (top-2 set locked but internal order
    // can flip). Keep source so it gets re-evaluated on new results.
    return {
      [`${prefix}Id`]: userId,
      [`${prefix}SourceGroupId`]: slot.groupId,
      [`${prefix}SourcePosition`]: slot.position,
    }
  }
  // Nothing decided — source only, no player
  return {
    [`${prefix}Id`]: null,
    [`${prefix}SourceGroupId`]: slot.groupId,
    [`${prefix}SourcePosition`]: slot.position,
  }
}

export interface BracketGeneratePreview {
  format: '4-groups' | '3-groups'
  pendingGroups: { groupId: string; groupNumber: number }[]
  firsts: Slot[]
  seconds: Slot[]
}

export async function previewBracket(categoryId: string): Promise<BracketGeneratePreview> {
  const groups = await loadGroupData(categoryId)
  const numGroups = groups.length

  if (numGroups !== 3 && numGroups !== 4) {
    throw new Error(
      `Formato de bracket no soportado: ${numGroups} grupos. Solo se soportan 3 o 4 grupos.`,
    )
  }

  const format: '4-groups' | '3-groups' = numGroups === 4 ? '4-groups' : '3-groups'
  const firsts = orderedFirsts(groups)
  const seconds = orderedSeconds(groups)
  const pendingGroups = groups
    .filter((g) => !g.qualifiers.qualifiersDecided)
    .map((g) => ({ groupId: g.groupId, groupNumber: g.groupNumber }))

  // Validate each group has enough players ranked
  for (const g of groups) {
    const required = numGroups === 4 ? 2 : format === '3-groups' ? 2 : 2
    if (g.ranking.length < required) {
      throw new Error(
        `El Grupo ${g.groupNumber} tiene menos de ${required} jugadores con partidos cargados. Cargá al menos un resultado antes de generar el bracket.`,
      )
    }
  }

  return { format, pendingGroups, firsts, seconds }
}

async function insertQFsAndSFs4Groups(
  tx: Tx,
  tournamentId: string,
  categoryId: string,
  firsts: Slot[],
  seconds: Slot[],
): Promise<void> {
  // firsts[0]=best, firsts[1]=2nd, firsts[2]=3rd, firsts[3]=worst
  // seconds[0]=best, seconds[1]=2nd, seconds[2]=3rd, seconds[3]=worst
  //
  // QF1: best first vs worst second       (firsts[0] vs seconds[3])
  // QF2: worst first vs best second       (firsts[3] vs seconds[0])
  // QF3: 2nd best first vs 3rd best second (firsts[1] vs seconds[2])
  // QF4: 3rd best first vs 2nd best second (firsts[2] vs seconds[1])
  //
  // SF mapping: QF1→SF1.p1, QF2→SF1.p2, QF3→SF2.p1, QF4→SF2.p2
  // Final: SF1→F.p1, SF2→F.p2

  const qfPairs: [Slot, Slot][] = [
    [firsts[0], seconds[3]],
    [firsts[3], seconds[0]],
    [firsts[1], seconds[2]],
    [firsts[2], seconds[1]],
  ]

  for (let i = 0; i < qfPairs.length; i++) {
    const [p1, p2] = qfPairs[i]
    await tx.match.create({
      data: {
        tournamentId,
        categoryId,
        stage: 'QUARTERFINAL',
        bracketPosition: i + 1,
        status: 'PENDING',
        ...slotAsMatchSide(p1, 'player1'),
        ...slotAsMatchSide(p2, 'player2'),
      },
    })
  }

  // Semis: both players null (to be filled by propagateWinner)
  for (let i = 1; i <= 2; i++) {
    await tx.match.create({
      data: {
        tournamentId,
        categoryId,
        stage: 'SEMIFINAL',
        bracketPosition: i,
        status: 'PENDING',
      },
    })
  }

  // Final: both players null
  await tx.match.create({
    data: {
      tournamentId,
      categoryId,
      stage: 'FINAL',
      bracketPosition: 1,
      status: 'PENDING',
    },
  })
}

async function insertQFsAndSFs3Groups(
  tx: Tx,
  tournamentId: string,
  categoryId: string,
  firsts: Slot[],
  seconds: Slot[],
): Promise<void> {
  // firsts: [best, 2nd best, 3rd best]
  // seconds: [best, 2nd best, worst]
  //
  // Mejores 1ºs directos a semis: firsts[0], firsts[1]
  // QF1 (débil — todos 2ºs): mejor 2º vs 2º mejor 2º    (seconds[0] vs seconds[1])
  // QF2 (fuerte — mixta): 3º mejor 1º vs peor 2º         (firsts[2] vs seconds[2])
  //
  // Razón: el ganador esperado de QF2 es el 1º de grupo (firsts[2]); el de QF1
  // es siempre un 2º. Por equidad, el mejor 1º (firsts[0], que tiene bye) cruza
  // con la QF de menor jerarquía esperada (la de dos 2ºs). El 2º mejor 1º
  // (firsts[1]) cruza con la QF que probablemente le mande otro 1º.
  //
  // SF1: firsts[0] (directo, player1) vs ganador QF1 (player2, se llena por propagateWinner)
  // SF2: firsts[1] (directo, player1) vs ganador QF2 (player2)
  // Final: ganador SF1 (player1) vs ganador SF2 (player2)

  // QF1: débil (dos 2ºs)
  await tx.match.create({
    data: {
      tournamentId,
      categoryId,
      stage: 'QUARTERFINAL',
      bracketPosition: 1,
      status: 'PENDING',
      ...slotAsMatchSide(seconds[0], 'player1'),
      ...slotAsMatchSide(seconds[1], 'player2'),
    },
  })

  // QF2: fuerte (mixta: 1º vs 2º)
  await tx.match.create({
    data: {
      tournamentId,
      categoryId,
      stage: 'QUARTERFINAL',
      bracketPosition: 2,
      status: 'PENDING',
      ...slotAsMatchSide(firsts[2], 'player1'),
      ...slotAsMatchSide(seconds[2], 'player2'),
    },
  })

  // SF1: firsts[0] directo + ganador QF1
  await tx.match.create({
    data: {
      tournamentId,
      categoryId,
      stage: 'SEMIFINAL',
      bracketPosition: 1,
      status: 'PENDING',
      ...slotAsMatchSide(firsts[0], 'player1'),
    },
  })

  // SF2: firsts[1] directo + ganador QF2
  await tx.match.create({
    data: {
      tournamentId,
      categoryId,
      stage: 'SEMIFINAL',
      bracketPosition: 2,
      status: 'PENDING',
      ...slotAsMatchSide(firsts[1], 'player1'),
    },
  })

  // Final
  await tx.match.create({
    data: {
      tournamentId,
      categoryId,
      stage: 'FINAL',
      bracketPosition: 1,
      status: 'PENDING',
    },
  })
}

export async function generateBracket(categoryId: string): Promise<BracketSummary> {
  const category = await prisma.tournamentCategory.findUniqueOrThrow({
    where: { id: categoryId },
    select: { id: true, tournamentId: true },
  })

  const preview = await previewBracket(categoryId)

  // Check there's no existing bracket
  const existing = await prisma.match.count({
    where: { categoryId, stage: { not: 'GROUP' } },
  })
  if (existing > 0) {
    throw new Error('Ya existe un bracket para esta categoría. Usá "Regenerar" para rehacerlo.')
  }

  await prisma.$transaction(async (tx) => {
    if (preview.format === '4-groups') {
      await insertQFsAndSFs4Groups(tx, category.tournamentId, categoryId, preview.firsts, preview.seconds)
    } else {
      await insertQFsAndSFs3Groups(tx, category.tournamentId, categoryId, preview.firsts, preview.seconds)
    }
  })

  return getBracketByCategory(categoryId)
}

export async function regenerateBracket(
  categoryId: string,
  opts: { force: boolean } = { force: false },
): Promise<BracketSummary> {
  const category = await prisma.tournamentCategory.findUniqueOrThrow({
    where: { id: categoryId },
    select: { id: true, tournamentId: true },
  })

  const preview = await previewBracket(categoryId)

  // Check if there are non-PENDING matches in bracket
  const advanced = await prisma.match.count({
    where: {
      categoryId,
      stage: { not: 'GROUP' },
      status: { in: ['CONFIRMED', 'PLAYED'] },
    },
  })
  if (advanced > 0 && !opts.force) {
    throw new Error(
      `Hay ${advanced} partido(s) del bracket confirmado(s) o jugado(s). Usá force=true para regenerar (se borran resultados y reservas).`,
    )
  }

  await prisma.$transaction(async (tx) => {
    // Delete existing bracket matches (cascade handles result + reservation)
    await tx.match.deleteMany({
      where: { categoryId, stage: { not: 'GROUP' } },
    })

    if (preview.format === '4-groups') {
      await insertQFsAndSFs4Groups(tx, category.tournamentId, categoryId, preview.firsts, preview.seconds)
    } else {
      await insertQFsAndSFs3Groups(tx, category.tournamentId, categoryId, preview.firsts, preview.seconds)
    }
  })

  return getBracketByCategory(categoryId)
}

export async function deleteBracket(categoryId: string): Promise<number> {
  const result = await prisma.match.deleteMany({
    where: { categoryId, stage: { not: 'GROUP' } },
  })
  return result.count
}

/**
 * Called after creating/updating a result for a GROUP match. Re-evaluates
 * qualifiers and updates bracket slots that source from the group. Each slot
 * (position 1 vs position 2) is evaluated independently so a group can have
 * its 1st spot locked while the 2nd is still in play.
 *
 * For each slot:
 * - If positionDecided: assigns the player and clears source (final).
 * - Else if a tentative player is known (qualifiers set locked): assigns
 *   player, keeps source so future results can re-assign.
 * - Else: sets player to null, keeps source.
 */
export async function refreshBracketSlotsFromGroup(groupId: string, tx?: Tx): Promise<void> {
  const client = tx ?? prisma
  const q = await getGroupQualifiers(groupId, tx)

  type SlotSide = 'player1' | 'player2'
  async function apply(side: SlotSide, position: 1 | 2) {
    const decided = position === 1 ? q.firstDecided : q.secondDecided
    const userId = position === 1 ? q.first : q.second

    let data: Record<string, string | number | null>
    if (decided && userId) {
      data = {
        [`${side}Id`]: userId,
        [`${side}SourceGroupId`]: null,
        [`${side}SourcePosition`]: null,
      }
    } else if (userId) {
      data = { [`${side}Id`]: userId }
    } else {
      // Clear any tentative assignment that is no longer valid
      data = { [`${side}Id`]: null }
    }

    await client.match.updateMany({
      where: { [`${side}SourceGroupId`]: groupId, [`${side}SourcePosition`]: position },
      data,
    })
  }

  await apply('player1', 1)
  await apply('player1', 2)
  await apply('player2', 1)
  await apply('player2', 2)
}

/**
 * Called after creating a result for a bracket match (QF or SF): propagate
 * the winner to the next round's match slot.
 */
export async function propagateWinner(matchId: string, tx?: Tx): Promise<void> {
  const client = tx ?? prisma
  const match = await client.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      categoryId: true,
      stage: true,
      bracketPosition: true,
      result: { select: { winnerId: true } },
    },
  })
  if (!match || !match.result || match.bracketPosition == null) return
  if (match.stage === 'GROUP' || match.stage === 'FINAL') return

  const winnerId = match.result.winnerId

  if (match.stage === 'QUARTERFINAL') {
    // Determine format by counting QFs in this category
    const qfCount = await client.match.count({
      where: { categoryId: match.categoryId, stage: 'QUARTERFINAL' },
    })

    if (qfCount === 4) {
      // Format A/B: QF1→SF1.p1, QF2→SF1.p2, QF3→SF2.p1, QF4→SF2.p2
      const qfPos = match.bracketPosition
      const sfPos = qfPos <= 2 ? 1 : 2
      const slot: 'player1Id' | 'player2Id' = qfPos % 2 === 1 ? 'player1Id' : 'player2Id'
      await client.match.updateMany({
        where: { categoryId: match.categoryId, stage: 'SEMIFINAL', bracketPosition: sfPos },
        data: { [slot]: winnerId },
      })
    } else if (qfCount === 2) {
      // Format C: QF1→SF1.p2, QF2→SF2.p2
      const sfPos = match.bracketPosition // 1 → SF1, 2 → SF2
      await client.match.updateMany({
        where: { categoryId: match.categoryId, stage: 'SEMIFINAL', bracketPosition: sfPos },
        data: { player2Id: winnerId },
      })
    }
    return
  }

  if (match.stage === 'SEMIFINAL') {
    // SF1→F.p1, SF2→F.p2
    const slot: 'player1Id' | 'player2Id' = match.bracketPosition === 1 ? 'player1Id' : 'player2Id'
    await client.match.updateMany({
      where: { categoryId: match.categoryId, stage: 'FINAL' },
      data: { [slot]: winnerId },
    })
  }
}

/**
 * When a bracket result changes (winner changes), clear the winner from the
 * next match's slot. Called from match-result-service on update if winner changed.
 *
 * Throws if the next round already has a result loaded — editing an earlier
 * round's winner would leave dangling references. The admin must regenerate
 * the bracket in that case.
 */
export async function retractWinner(matchId: string, previousWinnerId: string, tx?: Tx): Promise<void> {
  const client = tx ?? prisma
  const match = await client.match.findUnique({
    where: { id: matchId },
    select: { id: true, categoryId: true, stage: true, bracketPosition: true },
  })
  if (!match || match.bracketPosition == null) return
  if (match.stage === 'GROUP' || match.stage === 'FINAL') return

  if (match.stage === 'QUARTERFINAL') {
    const qfCount = await client.match.count({
      where: { categoryId: match.categoryId, stage: 'QUARTERFINAL' },
    })
    if (qfCount === 4) {
      const qfPos = match.bracketPosition
      const sfPos = qfPos <= 2 ? 1 : 2
      const slot: 'player1Id' | 'player2Id' = qfPos % 2 === 1 ? 'player1Id' : 'player2Id'
      const nextMatch = await client.match.findFirst({
        where: { categoryId: match.categoryId, stage: 'SEMIFINAL', bracketPosition: sfPos },
        include: { result: true },
      })
      if (nextMatch?.result) {
        throw new Error(
          `No se puede editar el ganador: la Semifinal ${sfPos} ya tiene resultado cargado. Regenerá el bracket primero.`,
        )
      }
      await client.match.updateMany({
        where: {
          categoryId: match.categoryId,
          stage: 'SEMIFINAL',
          bracketPosition: sfPos,
          [slot]: previousWinnerId,
        },
        data: { [slot]: null },
      })
    } else if (qfCount === 2) {
      const sfPos = match.bracketPosition
      const nextMatch = await client.match.findFirst({
        where: { categoryId: match.categoryId, stage: 'SEMIFINAL', bracketPosition: sfPos },
        include: { result: true },
      })
      if (nextMatch?.result) {
        throw new Error(
          `No se puede editar el ganador: la Semifinal ${sfPos} ya tiene resultado cargado. Regenerá el bracket primero.`,
        )
      }
      await client.match.updateMany({
        where: {
          categoryId: match.categoryId,
          stage: 'SEMIFINAL',
          bracketPosition: sfPos,
          player2Id: previousWinnerId,
        },
        data: { player2Id: null },
      })
    }
    return
  }

  if (match.stage === 'SEMIFINAL') {
    const slot: 'player1Id' | 'player2Id' = match.bracketPosition === 1 ? 'player1Id' : 'player2Id'
    const nextMatch = await client.match.findFirst({
      where: { categoryId: match.categoryId, stage: 'FINAL' },
      include: { result: true },
    })
    if (nextMatch?.result) {
      throw new Error(
        'No se puede editar el ganador: la Final ya tiene resultado cargado. Regenerá el bracket primero.',
      )
    }
    await client.match.updateMany({
      where: { categoryId: match.categoryId, stage: 'FINAL', [slot]: previousWinnerId },
      data: { [slot]: null },
    })
  }
}
